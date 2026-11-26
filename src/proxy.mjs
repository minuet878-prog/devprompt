import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { AgentDispatcher } from "./dispatcher.mjs";
import { formatMarkdown } from "./store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OVERLAY_PATH = path.join(__dirname, "overlay.js");

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function sendJson(res, status, data) {
  const body = Buffer.from(JSON.stringify(data), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readRequestBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error("請求內容過大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function decompressBody(buffer, encoding) {
  const normalized = String(encoding || "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "identity") {
    return buffer;
  }
  if (normalized === "gzip" || normalized === "x-gzip") {
    return zlib.gunzipSync(buffer);
  }
  if (normalized === "deflate") {
    return zlib.inflateSync(buffer);
  }
  if (normalized === "br") {
    return zlib.brotliDecompressSync(buffer);
  }
  return buffer;
}

export function adaptCspHeader(cspValue) {
  if (!cspValue) {
    return { header: null, nonce: null };
  }
  const directives = cspValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  let scriptNonce = null;
  let hasScriptSrc = false;
  let hasStyleSrc = false;
  let hasConnectSrc = false;

  const updated = directives.map((directive) => {
    const [name, ...tokens] = directive.split(/\s+/);
    const lower = name.toLowerCase();
    if (lower === "script-src") {
      hasScriptSrc = true;
      const nonceToken = tokens.find((t) => /^'nonce-[^']+'$/i.test(t));
      if (nonceToken) {
        scriptNonce = nonceToken.slice(7, -1);
      }
      if (!tokens.includes("'self'") && !nonceToken) {
        tokens.push("'self'");
      }
      return `${name} ${tokens.join(" ")}`;
    }
    if (lower === "style-src") {
      hasStyleSrc = true;
      if (!tokens.includes("'unsafe-inline'")) {
        tokens.push("'unsafe-inline'");
      }
      return `${name} ${tokens.join(" ")}`;
    }
    if (lower === "connect-src") {
      hasConnectSrc = true;
      if (!tokens.includes("'self'")) {
        tokens.push("'self'");
      }
      return `${name} ${tokens.join(" ")}`;
    }
    if (lower === "default-src") {
      if (!tokens.includes("'self'")) {
        tokens.push("'self'");
      }
      return `${name} ${tokens.join(" ")}`;
    }
    return directive;
  });

  if (!hasScriptSrc) {
    const defaultDir = directives.find((d) => d.toLowerCase().startsWith("default-src"));
    if (defaultDir) {
      const nonceToken = defaultDir.split(/\s+/).find((t) => /^'nonce-[^']+'$/i.test(t));
      if (nonceToken) {
        scriptNonce = nonceToken.slice(7, -1);
      }
    }
  }
  if (!hasStyleSrc && directives.some((d) => d.toLowerCase().startsWith("default-src"))) {
    updated.push("style-src 'self' 'unsafe-inline'");
  }
  if (!hasConnectSrc && directives.some((d) => d.toLowerCase().startsWith("default-src"))) {
    updated.push("connect-src 'self'");
  }

  return { header: updated.join("; "), nonce: scriptNonce };
}

export function injectOverlayScript(html, nonce) {
  const nonceAttr = nonce ? ` nonce="${nonce.replace(/"/g, "&quot;")}"` : "";
  const tag = `<script defer src="/__dev-prompt__/overlay.js" data-api-base="/__dev-prompt__/items/"${nonceAttr}></script>`;
  const closeBody = /<\/body\s*>/i;
  if (closeBody.test(html)) {
    return html.replace(closeBody, `${tag}\n</body>`);
  }
  return `${html}\n${tag}`;
}

export function rewriteSetCookie(cookieHeader) {
  const rewriteOne = (cookie) =>
    cookie
      .replace(/;\s*Secure\b/gi, "")
      .replace(/;\s*Domain=[^;]+/gi, "");
  if (Array.isArray(cookieHeader)) {
    return cookieHeader.map(rewriteOne);
  }
  return rewriteOne(cookieHeader);
}

function rewriteLocation(location, targetOrigin, proxyHost) {
  if (!location || !proxyHost) {
    return location;
  }
  if (location.startsWith(targetOrigin)) {
    return `http://${proxyHost}${location.slice(targetOrigin.length)}`;
  }
  return location;
}

function rewriteUpstreamHeaders(reqHeaders, targetUrl) {
  const headers = {};
  const proxyHost = reqHeaders.host || "";
  for (const [key, value] of Object.entries(reqHeaders)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || value === undefined) {
      continue;
    }
    if (lower === "host") {
      headers.host = targetUrl.host;
      continue;
    }
    if (lower === "origin" && typeof value === "string" && proxyHost && value.includes(proxyHost)) {
      headers.origin = targetUrl.origin;
      continue;
    }
    if (lower === "referer" && typeof value === "string" && proxyHost) {
      try {
        const refUrl = new URL(value);
        if (refUrl.host === proxyHost) {
          headers.referer = `${targetUrl.origin}${refUrl.pathname}${refUrl.search}`;
          continue;
        }
      } catch {
        // Keep original referer if malformed.
      }
    }
    headers[lower] = value;
  }
  headers.host = targetUrl.host;
  return headers;
}

async function handleInternalRoute(
  req,
  res,
  pathname,
  store,
  dispatcher,
  targetOrigin,
  overlayPath
) {
  if (pathname === "/__dev-prompt__/overlay.js" && req.method === "GET") {
    const source = fs.readFileSync(overlayPath);
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Content-Length": String(source.length),
      "Cache-Control": "no-store",
    });
    res.end(source);
    return true;
  }

  if (pathname === "/__dev-prompt__/prompts.md" && req.method === "GET") {
    const md = Buffer.from(formatMarkdown(store.load()), "utf8");
    res.writeHead(200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Length": String(md.length),
      "Cache-Control": "no-store",
    });
    res.end(md);
    return true;
  }

  if (pathname === "/__dev-prompt__/prompt-preview/" || pathname === "/__dev-prompt__/prompt-preview") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "不支援的方法" });
      return true;
    }
    const { items, prompt } = dispatcher.buildPreview();
    sendJson(res, 200, {
      open_count: items.length,
      prompt,
      ...dispatcher.getStatus(),
    });
    return true;
  }

  if (pathname === "/__dev-prompt__/dispatch/" || pathname === "/__dev-prompt__/dispatch") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "不支援的方法" });
      return true;
    }
    try {
      const raw = await readRequestBody(req);
      const body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      const result = dispatcher.dispatch(body.item_ids || null);
      sendJson(res, 202, result);
    } catch (err) {
      sendJson(res, err.statusCode || 400, { error: err.message || "無法送給 Agent" });
    }
    return true;
  }

  if (
    pathname === "/__dev-prompt__/dispatch/status/" ||
    pathname === "/__dev-prompt__/dispatch/status"
  ) {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "不支援的方法" });
      return true;
    }
    sendJson(res, 200, dispatcher.getStatus());
    return true;
  }

  if (pathname === "/__dev-prompt__/wait/" || pathname === "/__dev-prompt__/wait") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "不支援的方法" });
      return true;
    }
    const unregister = dispatcher.registerWaiter((payload) => {
      if (!res.writableEnded) {
        sendJson(res, 200, payload);
      }
    });
    req.on("close", unregister);
    return true;
  }

  if (pathname === "/__dev-prompt__/items/" || pathname === "/__dev-prompt__/items") {
    if (req.method === "GET") {
      sendJson(res, 200, {
        items: store.load(),
        ...dispatcher.getStatus(),
      });
      return true;
    }
    if (req.method === "POST") {
      try {
        const raw = await readRequestBody(req);
        const body = JSON.parse(raw.toString("utf8"));
        const item = store.add({ ...body, target: targetOrigin });
        sendJson(res, 201, { item });
      } catch (err) {
        sendJson(res, 400, { error: err.message || "請送出有效的 JSON 資料" });
      }
      return true;
    }
    sendJson(res, 405, { error: "不支援的方法" });
    return true;
  }

  if (pathname === "/__dev-prompt__/items/clear/" || pathname === "/__dev-prompt__/items/clear") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "不支援的方法" });
      return true;
    }
    store.clear();
    sendJson(res, 200, { cleared: true });
    return true;
  }

  const itemMatch = pathname.match(/^\/__dev-prompt__\/items\/([^/]+)\/?$/);
  if (itemMatch) {
    const itemId = decodeURIComponent(itemMatch[1]);
    if (req.method === "DELETE") {
      if (!store.remove(itemId)) {
        sendJson(res, 404, { error: "找不到這筆標註" });
        return true;
      }
      sendJson(res, 200, { deleted: itemId });
      return true;
    }
    if (req.method === "PATCH") {
      try {
        const raw = await readRequestBody(req);
        const body = JSON.parse(raw.toString("utf8"));
        const updated = store.updateStatus(itemId, body.status, body.resolution || "");
        if (!updated) {
          sendJson(res, 404, { error: "找不到這筆標註" });
          return true;
        }
        sendJson(res, 200, { item: updated });
      } catch (err) {
        sendJson(res, 400, { error: err.message || "更新失敗" });
      }
      return true;
    }
    sendJson(res, 405, { error: "不支援的方法" });
    return true;
  }

  return false;
}

export function createProxyServer({
  target,
  store,
  dispatcher = null,
  projectDir = process.cwd(),
  agent = "auto",
  agentArgs = [],
  overlayPath = DEFAULT_OVERLAY_PATH,
}) {
  const targetUrl = new URL(target);
  const isHttps = targetUrl.protocol === "https:";
  const transport = isHttps ? https : http;
  const upstreamPort = targetUrl.port ? Number(targetUrl.port) : isHttps ? 443 : 80;
  const activeDispatcher =
    dispatcher ||
    new AgentDispatcher({
      store,
      projectDir,
      targetUrl: targetUrl.origin,
      agent,
      agentArgs,
    });

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (reqUrl.pathname.startsWith("/__dev-prompt__/")) {
      const handled = await handleInternalRoute(
        req,
        res,
        reqUrl.pathname,
        store,
        activeDispatcher,
        targetUrl.origin,
        overlayPath
      );
      if (handled) {
        return;
      }
    }

    const upstreamPath = `${reqUrl.pathname}${reqUrl.search}`;
    const proxyReq = transport.request(
      {
        hostname: targetUrl.hostname,
        port: upstreamPort,
        method: req.method,
        path: upstreamPath,
        headers: rewriteUpstreamHeaders(req.headers, targetUrl),
      },
      (upstreamRes) => {
        const headers = {};
        for (const [key, value] of Object.entries(upstreamRes.headers)) {
          const lower = key.toLowerCase();
          if (HOP_BY_HOP_HEADERS.has(lower) || value === undefined) {
            continue;
          }
          headers[lower] = value;
        }

        if (headers.location) {
          headers.location = rewriteLocation(
            headers.location,
            targetUrl.origin,
            req.headers.host || ""
          );
        }
        if (headers["set-cookie"]) {
          headers["set-cookie"] = rewriteSetCookie(headers["set-cookie"]);
        }

        const contentType = String(headers["content-type"] || "").toLowerCase();
        const isHtml =
          contentType.includes("text/html") &&
          req.method !== "HEAD" &&
          upstreamRes.statusCode !== 204 &&
          upstreamRes.statusCode !== 304;

        if (!isHtml) {
          res.writeHead(upstreamRes.statusCode || 502, headers);
          upstreamRes.pipe(res);
          return;
        }

        const chunks = [];
        upstreamRes.on("data", (chunk) => chunks.push(chunk));
        upstreamRes.on("end", () => {
          try {
            const rawBuffer = Buffer.concat(chunks);
            const plainBuffer = decompressBody(rawBuffer, headers["content-encoding"]);
            const html = plainBuffer.toString("utf8");

            const cspResult = adaptCspHeader(headers["content-security-policy"]);
            if (cspResult.header) {
              headers["content-security-policy"] = cspResult.header;
            }
            delete headers["content-encoding"];
            delete headers["content-length"];
            delete headers.etag;

            const injected = Buffer.from(injectOverlayScript(html, cspResult.nonce), "utf8");
            headers["content-length"] = String(injected.length);
            res.writeHead(upstreamRes.statusCode || 200, headers);
            res.end(injected);
          } catch (err) {
            res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(`dev-prompt 代理處理頁面失敗：${err.message}`);
          }
        });
      }
    );

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end(
        `dev-prompt 連不到目標伺服器 ${targetUrl.origin}（${err.message}）。請確認你的開發伺服器正在執行。`
      );
    });

    req.pipe(proxyReq);
  });

  server.on("upgrade", (req, socket, head) => {
    const upstreamSocket = isHttps
      ? tls.connect({
          host: targetUrl.hostname,
          port: upstreamPort,
          servername: targetUrl.hostname,
        })
      : net.connect({ host: targetUrl.hostname, port: upstreamPort });

    upstreamSocket.on("connect", () => {
      const headers = rewriteUpstreamHeaders(req.headers, targetUrl);
      headers.connection = req.headers.connection || "Upgrade";
      headers.upgrade = req.headers.upgrade || "websocket";
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            lines.push(`${key}: ${item}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      upstreamSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head && head.length) {
        upstreamSocket.write(head);
      }
      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
    });

    const cleanup = () => {
      socket.destroy();
      upstreamSocket.destroy();
    };
    upstreamSocket.on("error", cleanup);
    socket.on("error", cleanup);
  });

  return server;
}
