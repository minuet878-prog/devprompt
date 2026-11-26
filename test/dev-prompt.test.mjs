import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import zlib from "node:zlib";

import { AgentDispatcher } from "../src/dispatcher.mjs";
import { buildAgentPrompt } from "../src/prompt-builder.mjs";
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

async function waitForStatus(url, predicate, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url);
    const data = await res.json();
    if (predicate(data)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("Timed out waiting for dispatch status");
}

describe("CSP, cookie, and prompt builder helpers", () => {
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

  test("organizes open annotations by page into a structured AI prompt", () => {
    const prompt = buildAgentPrompt({
      projectDir: "/tmp/demo-app",
      targetUrl: "http://127.0.0.1:8000",
      items: [
        {
          id: "aa11",
          status: "open",
          url: "/home/",
          page_title: "首頁",
          device: "mobile",
          viewport: { width: 390, height: 844 },
          selector: "main > a.cta",
          tag: "a",
          text: "開始篩檢",
          attributes: "href=/screening/",
          rect: { top: 100, left: 20, width: 350, height: 48 },
          prompt: "按鈕高度再高一點",
        },
        {
          id: "bb22",
          status: "done",
          url: "/home/",
          prompt: "已完成不應出現",
        },
      ],
    });
    assert.match(prompt, /專案目錄：`\/tmp\/demo-app`/);
    assert.match(prompt, /### 頁面：`\/home\/`（首頁）/);
    assert.match(prompt, /標註 `#aa11`.*手機 390×844/);
    assert.match(prompt, /按鈕高度再高一點/);
    assert.doesNotMatch(prompt, /已完成不應出現/);
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
    proxyServer = createProxyServer({
      target: upstreamUrl,
      store,
      projectDir: tmpDir,
      agent: "none",
    });
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

    const previewRes = await fetch(`${proxyUrl}/__dev-prompt__/prompt-preview/`);
    const preview = await previewRes.json();
    assert.equal(preview.open_count, 1);
    assert.match(preview.prompt, /手機版按鈕間距拉大一點/);

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

    store.add({ prompt: "第二筆測試", viewport: { width: 1280, height: 800 } });
    assert.equal(store.load()[0].device, "desktop");
    const clearRes = await fetch(`${proxyUrl}/__dev-prompt__/items/clear/`, { method: "POST" });
    assert.equal(clearRes.status, 200);
    assert.equal(store.load().length, 0);
  });

  test("hands off organized prompt immediately to an active conversation waiter", async () => {
    const item = store.add({
      url: "/screening/",
      viewport: { width: 390, height: 844 },
      selector: "button.submit",
      tag: "button",
      text: "送出",
      prompt: "改成大一點的藍色按鈕",
    });

    const waitPromise = fetch(`${proxyUrl}/__dev-prompt__/wait/`).then((r) => r.json());
    // Wait briefly so the waiter registers on the server.
    await new Promise((r) => setTimeout(r, 30));

    const dispatchRes = await fetch(`${proxyUrl}/__dev-prompt__/dispatch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_ids: [item.id] }),
    });
    assert.equal(dispatchRes.status, 202);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.job.status, "handed_off");
    assert.equal(dispatchData.job.mode, "active-conversation");

    const received = await waitPromise;
    assert.deepEqual(received.item_ids, [item.id]);
    assert.match(received.prompt, /改成大一點的藍色按鈕/);
    store.clear();
  });
});

describe("AgentDispatcher backends", () => {
  test("runs a custom agent command, captures summary, and marks items done", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-prompt-agent-"));
    const capturedFile = path.join(tmpDir, "received-prompt.txt");
    const store = new PromptStore(path.join(tmpDir, ".dev-prompts.json"));
    const dummyUpstream = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    const upstreamUrl = await listen(dummyUpstream);

    const fakeAgentPath = path.join(tmpDir, "fake-agent.mjs");
    fs.writeFileSync(
      fakeAgentPath,
      [
        'import fs from "node:fs";',
        'const input = fs.readFileSync(0, "utf8");',
        `fs.writeFileSync(${JSON.stringify(capturedFile)}, input, "utf8");`,
        'console.log("已更新按鈕樣式與間距");',
      ].join("\n"),
      "utf8"
    );
    const customCmd = `node ${JSON.stringify(fakeAgentPath)}`;
    const proxy = createProxyServer({
      target: upstreamUrl,
      store,
      projectDir: tmpDir,
      agent: customCmd,
    });
    const proxyUrl = await listen(proxy);

    try {
      const item = store.add({
        url: "/guide/",
        viewport: { width: 390, height: 844 },
        selector: "h1.title",
        tag: "h1",
        text: "選配指引",
        prompt: "標題下方多留一點空白",
      });

      const res = await fetch(`${proxyUrl}/__dev-prompt__/dispatch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: [item.id] }),
      });
      assert.equal(res.status, 202);

      const finalStatus = await waitForStatus(
        `${proxyUrl}/__dev-prompt__/dispatch/status/`,
        (data) => data.job.status === "done" || data.job.status === "error"
      );
      assert.equal(finalStatus.job.status, "done");
      assert.match(finalStatus.job.summary, /已更新按鈕樣式與間距/);

      const savedPrompt = fs.readFileSync(capturedFile, "utf8");
      assert.match(savedPrompt, /標題下方多留一點空白/);

      const updatedItems = store.load();
      assert.equal(updatedItems[0].status, "done");
      assert.match(updatedItems[0].resolution, /已更新按鈕樣式與間距/);
    } finally {
      await close(proxy);
      await close(dummyUpstream);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("dispatches organized prompt directly to Antigravity App ConversationService", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-prompt-agy-app-"));
    const store = new PromptStore(path.join(tmpDir, ".dev-prompts.json"));
    let receivedReq = null;

    const mockLs = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedReq = {
          url: req.url,
          headers: req.headers,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ conversation: { id: "conv-12345678" } }));
      });
    });
    const mockLsUrl = await listen(mockLs);
    const lsHostPort = new URL(mockLsUrl).host;

    const dummyUpstream = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    const upstreamUrl = await listen(dummyUpstream);

    const dispatcher = new AgentDispatcher({
      store,
      projectDir: tmpDir,
      targetUrl: upstreamUrl,
      agent: "auto",
      env: {
        ...process.env,
        ANTIGRAVITY_LS_ADDRESS: lsHostPort,
        ANTIGRAVITY_CSRF_TOKEN: "secret-csrf",
        ANTIGRAVITY_PROJECT_ID: "proj-hearwell",
      },
    });
    assert.equal(dispatcher.agent, "antigravity-app");

    const proxy = createProxyServer({ target: upstreamUrl, store, dispatcher });
    const proxyUrl = await listen(proxy);

    try {
      store.add({
        url: "/about/",
        viewport: { width: 1280, height: 800 },
        selector: "footer a",
        tag: "a",
        text: "意見回饋",
        prompt: "把頁尾文字對齊中央",
      });

      const res = await fetch(`${proxyUrl}/__dev-prompt__/dispatch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(res.status, 202);

      const finalStatus = await waitForStatus(
        `${proxyUrl}/__dev-prompt__/dispatch/status/`,
        (data) => data.job.status === "handed_off" || data.job.status === "error"
      );
      assert.equal(finalStatus.job.status, "handed_off");
      assert.match(finalStatus.job.summary, /Antigravity App/);
      assert.equal(receivedReq.url, "/product.v1.ConversationService/CreateConversation");
      assert.equal(receivedReq.headers["x-antigravity-csrf-token"], "secret-csrf");
      assert.equal(receivedReq.headers["connect-protocol-version"], "1");
      assert.equal(receivedReq.body.projectId, "proj-hearwell");
      assert.deepEqual(receivedReq.body.tags, ["dev-prompt"]);
      assert.match(receivedReq.body.prompt[0].text, /把頁尾文字對齊中央/);
    } finally {
      await close(proxy);
      await close(dummyUpstream);
      await close(mockLs);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
