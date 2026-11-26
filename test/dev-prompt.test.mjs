import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import zlib from "node:zlib";

import { adaptCspHeader, createProxyServer, rewriteSetCookie } from "../src/proxy.mjs";
import { PromptStore, formatMarkdown } from "../src/store.mjs";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

describe("CSP and cookie helpers", () => {
  test("extracts nonce from strict CSP and keeps self/unsafe-inline usable", () => {
    const csp = "default-src 'self'; script-src 'self' 'nonce-abc123'; style-src 'self'";
    const result = adaptCspHeader(csp);
    assert.equal(result.nonce, "abc123");
    assert.match(result.header, /script-src 'self' 'nonce-abc123'/);
    assert.match(result.header, /style-src 'self' 'unsafe-inline'/);
    assert.match(result.header, /connect-src 'self'/);
  });

  test("strips Secure and Domain from Set-Cookie for local LAN HTTP preview", () => {
    const cookies = rewriteSetCookie([
      "sessionid=xyz; Path=/; HttpOnly; Secure; Domain=tingpal.tw; SameSite=Lax",
    ]);
    assert.equal(cookies.length, 1);
    assert.doesNotMatch(cookies[0], /\bSecure\b/i);
    assert.doesNotMatch(cookies[0], /\bDomain=/i);
    assert.match(cookies[0], /sessionid=xyz/);
  });
});

describe("dev-prompt proxy and store", () => {
  let tmpDir;
  let store;
  let upstreamServer;
  let upstreamUrl;
  let proxyServer;
  let proxyUrl;
  let lastUpstreamHeaders = {};

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-prompt-test-"));
    store = new PromptStore(path.join(tmpDir, ".dev-prompts.json"));

    upstreamServer = http.createServer((req, res) => {
      lastUpstreamHeaders = req.headers;

      if (req.url === "/plain") {
        const html = "<!doctype html><html><body><h1>Hello</h1></body></html>";
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'self'; script-src 'self' 'nonce-testnonce'",
        });
        res.end(html);
        return;
      }

      if (req.url === "/gzip") {
        const html = "<!doctype html><html><body><p>Compressed</p></body></html>";
        const gz = zlib.gzipSync(Buffer.from(html, "utf8"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Encoding": "gzip",
        });
        res.end(gz);
        return;
      }

      if (req.url === "/api/data") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.url === "/redirect") {
        res.writeHead(302, {
          Location: `${upstreamUrl}/plain`,
          "Set-Cookie": "sid=123; Path=/; Secure; Domain=example.com",
        });
        res.end();
        return;
      }

      if (req.url === "/echo-post" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            host: req.headers.host,
            origin: req.headers.origin,
            referer: req.headers.referer,
          })
        );
        return;
      }

      res.writeHead(404);
      res.end("not found");
    });

    upstreamUrl = await listen(upstreamServer);
    proxyServer = createProxyServer({ target: upstreamUrl, store });
    proxyUrl = await listen(proxyServer);
  });

  after(async () => {
    await close(proxyServer);
    await close(upstreamServer);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("injects overlay script with upstream CSP nonce on HTML responses", async () => {
    const res = await fetch(`${proxyUrl}/plain`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(
      html,
      /<script defer src="\/__dev-prompt__\/overlay\.js" data-api-base="\/__dev-prompt__\/items\/" nonce="testnonce"><\/script>\n<\/body>/
    );
  });

  test("decompresses gzip HTML before injecting overlay script", async () => {
    const res = await fetch(`${proxyUrl}/gzip`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<p>Compressed<\/p>/);
    assert.match(html, /\/__dev-prompt__\/overlay\.js/);
  });

  test("passes non-HTML responses through untouched", async () => {
    const res = await fetch(`${proxyUrl}/api/data`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("rewrites redirect Location and strips Secure cookie attribute", async () => {
    const res = await fetch(`${proxyUrl}/redirect`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), `${proxyUrl}/plain`);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.doesNotMatch(setCookie, /\bSecure\b/i);
    assert.doesNotMatch(setCookie, /\bDomain=/i);
  });

  test("rewrites Origin and Referer headers on POST for CSRF compatibility", async () => {
    const res = await fetch(`${proxyUrl}/echo-post`, {
      method: "POST",
      headers: {
        Origin: proxyUrl,
        Referer: `${proxyUrl}/plain`,
      },
      body: "hello=1",
    });
    assert.equal(res.status, 200);
    const echoed = await res.json();
    const targetOrigin = new URL(upstreamUrl).origin;
    assert.equal(echoed.host, new URL(upstreamUrl).host);
    assert.equal(echoed.origin, targetOrigin);
    assert.equal(echoed.referer, `${targetOrigin}/plain`);
    assert.equal(lastUpstreamHeaders.host, new URL(upstreamUrl).host);
  });

  test("serves overlay script and manages prompt CRUD lifecycle", async () => {
    const jsRes = await fetch(`${proxyUrl}/__dev-prompt__/overlay.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get("content-type") || "", /javascript/);
    assert.match(await jsRes.text(), /dev-prompt-host/);

    const badRes = await fetch(`${proxyUrl}/__dev-prompt__/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    });
    assert.equal(badRes.status, 400);

    const createRes = await fetch(`${proxyUrl}/__dev-prompt__/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "/my-hearing/",
        page_title: "我的聽力",
        viewport: { width: 390, height: 844 },
        selector: "main > a.btn",
        tag: "a",
        text: "開始篩檢",
        prompt: "手機版按鈕間距拉大一點",
      }),
    });
    assert.equal(createRes.status, 201);
    const { item } = await createRes.json();
    assert.equal(item.device, "mobile");
    assert.equal(item.status, "open");
    assert.equal(item.target, new URL(upstreamUrl).origin);

    const listRes = await fetch(`${proxyUrl}/__dev-prompt__/items/`);
    const { items } = await listRes.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, item.id);

    const mdRes = await fetch(`${proxyUrl}/__dev-prompt__/prompts.md`);
    const md = await mdRes.text();
    assert.match(md, /手機 390×844/);
    assert.match(md, /手機版按鈕間距拉大一點/);

    const patchRes = await fetch(`${proxyUrl}/__dev-prompt__/items/${item.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", resolution: "已加大間距" }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.item.status, "done");
    assert.equal(patched.item.resolution, "已加大間距");
    assert.match(formatMarkdown(store.load()), /目前沒有待處理的標註/);

    const delRes = await fetch(`${proxyUrl}/__dev-prompt__/items/${item.id}/`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);
    assert.equal(store.load().length, 0);

    await store.add({ prompt: "第二筆測試", viewport: { width: 1280, height: 800 } });
    assert.equal(store.load()[0].device, "desktop");
    const clearRes = await fetch(`${proxyUrl}/__dev-prompt__/items/clear/`, { method: "POST" });
    assert.equal(clearRes.status, 200);
    assert.equal(store.load().length, 0);
  });
});
