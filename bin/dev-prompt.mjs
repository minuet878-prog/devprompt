#!/usr/bin/env node
import os from "node:os";
import path from "node:path";

import { createProxyServer } from "../src/proxy.mjs";
import { PromptStore, formatMarkdown } from "../src/store.mjs";

function printHelp() {
  console.log(`dev-prompt — 跨框架瀏覽器／手機畫面點選標註工具

用法：
  dev-prompt [目標網址] [選項]
  dev-prompt list [--out <檔案>]
  dev-prompt done <id|all> [--out <檔案>]
  dev-prompt clear [--out <檔案>]

常用範例：
  dev-prompt http://127.0.0.1:8000
  dev-prompt http://localhost:3000 --port 8787 --project ~/HearWell
  dev-prompt https://tingpal.tw --out ~/HearWell/.dev-prompts.json

選項：
  --target <url>     要代理的目標網站（預設 http://127.0.0.1:8000）
  --port <number>    本機代理埠號（預設 8787）
  --host <ip>        監聽位址（預設 0.0.0.0，允許同 Wi-Fi 手機連線）
  --project <dir>    將標註存到指定專案的 .dev-prompts.json
  --out <file>       指定標註 JSON 檔案路徑（預設為目前目錄的 .dev-prompts.json）
  -h, --help         顯示說明`);
}

function parseArgs(argv) {
  const args = {
    command: "serve",
    positionals: [],
    target: null,
    port: 8787,
    host: "0.0.0.0",
    out: null,
    project: null,
    help: false,
  };

  const raw = [...argv];
  if (raw[0] && ["list", "done", "clear"].includes(raw[0])) {
    args.command = raw.shift();
  }

  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (token === "-h" || token === "--help") {
      args.help = true;
    } else if (token === "--target") {
      args.target = raw[++i];
    } else if (token === "--port") {
      args.port = Number(raw[++i]);
    } else if (token === "--host") {
      args.host = raw[++i];
    } else if (token === "--out") {
      args.out = raw[++i];
    } else if (token === "--project") {
      args.project = raw[++i];
    } else if (!token.startsWith("-")) {
      args.positionals.push(token);
    } else {
      throw new Error(`不認識的選項：${token}`);
    }
  }
  return args;
}

function resolveStorePath(args) {
  if (args.out) {
    return path.resolve(args.out);
  }
  if (args.project) {
    return path.resolve(args.project, ".dev-prompts.json");
  }
  return path.resolve(process.cwd(), ".dev-prompts.json");
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const list of Object.values(interfaces)) {
    for (const info of list || []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    return;
  }

  const store = new PromptStore(resolveStorePath(args));

  if (args.command === "list") {
    process.stdout.write(formatMarkdown(store.load()));
    return;
  }

  if (args.command === "done") {
    const targetId = args.positionals[0] || "all";
    const count = store.markDone(targetId);
    console.log(`已將 ${count} 筆標註標記為完成（${store.filePath}）`);
    return;
  }

  if (args.command === "clear") {
    store.clear();
    console.log(`已清空標註清單（${store.filePath}）`);
    return;
  }

  const target = args.target || args.positionals[0] || "http://127.0.0.1:8000";
  try {
    new URL(target);
  } catch {
    console.error(`目標網址格式不正確：${target}（請加上 http:// 或 https://）`);
    process.exit(1);
  }

  if (!Number.isInteger(args.port) || args.port <= 0 || args.port > 65535) {
    console.error(`埠號不正確：${args.port}`);
    process.exit(1);
  }

  const server = createProxyServer({ target, store });
  server.listen(args.port, args.host, () => {
    const lanIps = getLanAddresses();
    console.log("");
    console.log("dev-prompt 代理已啟動");
    console.log(`  代理目標：${target}`);
    console.log(`  電腦打開：http://127.0.0.1:${args.port}`);
    if (lanIps.length) {
      for (const ip of lanIps) {
        console.log(`  手機打開：http://${ip}:${args.port}  （手機連同一個 Wi-Fi）`);
      }
    } else {
      console.log("  手機打開：未偵測到區網 IP（請確認電腦已連上 Wi-Fi）");
    }
    console.log(`  標註存檔：${store.filePath}`);
    console.log("");
    console.log("提示：在電腦或手機畫面點右下角「點選標註」送出後，回 AI 對話說「處理標註」即可。");
    console.log("按 Ctrl+C 結束。");
  });
}

main();
