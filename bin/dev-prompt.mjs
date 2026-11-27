#!/usr/bin/env node
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { resolveAgentMode } from "../src/dispatcher.mjs";
import { buildAgentPrompt } from "../src/prompt-builder.mjs";
import { createProxyServer } from "../src/proxy.mjs";
import { PromptStore, formatMarkdown } from "../src/store.mjs";

function printHelp() {
  console.log(`dev-prompt — 跨框架瀏覽器／手機畫面點選標註與 Agent 自動派送工具

用法：
  dev-prompt [目標網址] [選項]
  dev-prompt wait [--port 8787]
  dev-prompt prompt [--project <dir>|--out <檔案>]
  dev-prompt list [--project <dir>|--out <檔案>]
  dev-prompt done <id|all> [--project <dir>|--out <檔案>]
  dev-prompt clear [--project <dir>|--out <檔案>]

常用範例：
  dev-prompt http://127.0.0.1:8000 --project ~/HearWell
  dev-prompt http://127.0.0.1:8000 --project ~/HearWell --agent agy
  dev-prompt http://127.0.0.1:8001 --port 8787 --exec "py313/bin/python manage.py runserver 8001"
  dev-prompt wait --port 8787

選項：
  --target <url>     要代理的目標網站（預設 http://127.0.0.1:8000）
  --port <number>    本機代理埠號（預設 8787）
  --host <ip>        監聽位址（預設 0.0.0.0，允許同 Wi-Fi 手機連線）
  --project <dir>    目標專案目錄（預設為目前目錄；Agent 會在此目錄執行修改）
  --out <file>       指定標註 JSON 檔案路徑（預設為專案目錄的 .dev-prompts.json）
  --agent <mode>     派送對象：auto（預設，排隊等開著的對話跑 dev-prompt wait 來拿；在 Antigravity App 裡則開新對話）| antigravity-app | agy | claude | 自訂指令
  --agent-args <s>   額外傳給 agy / claude 的參數（以空白分隔）
  --exec <cmd>       同時啟動並管理上游開發伺服器（適合整合進 Claude Desktop launch.json）
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
    agent: "auto",
    agentArgs: [],
    exec: null,
    help: false,
  };

  const raw = [...argv];
  if (raw[0] && ["list", "prompt", "done", "clear", "wait"].includes(raw[0])) {
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
    } else if (token === "--agent") {
      args.agent = raw[++i];
    } else if (token === "--agent-args") {
      args.agentArgs = String(raw[++i] || "")
        .split(/\s+/)
        .filter(Boolean);
    } else if (token === "--exec") {
      args.exec = raw[++i];
    } else if (!token.startsWith("-")) {
      args.positionals.push(token);
    } else {
      throw new Error(`不認識的選項：${token}`);
    }
  }
  return args;
}

function resolveProjectDir(args) {
  return path.resolve(args.project || process.cwd());
}

function resolveStorePath(args) {
  if (args.out) {
    return path.resolve(args.out);
  }
  return path.join(resolveProjectDir(args), ".dev-prompts.json");
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

function runWait(port) {
  const req = http.get(`http://127.0.0.1:${port}/__dev-prompt__/wait/`, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (payload.prompt) {
          process.stdout.write(payload.prompt);
        }
      } catch {
        process.exit(1);
      }
    });
  });
  req.on("error", (err) => {
    console.error(`連不到本機 dev-prompt（127.0.0.1:${port}）：${err.message}`);
    process.exit(1);
  });
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

  if (args.command === "wait") {
    runWait(args.port);
    return;
  }

  const projectDir = resolveProjectDir(args);
  const store = new PromptStore(resolveStorePath(args));

  if (args.command === "list") {
    process.stdout.write(formatMarkdown(store.load()));
    return;
  }

  if (args.command === "prompt") {
    const text = buildAgentPrompt({ items: store.load(), projectDir });
    process.stdout.write(text || "目前沒有待處理的標註。\n");
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

  let upstreamChild = null;
  if (args.exec) {
    upstreamChild = spawn(args.exec, {
      cwd: projectDir,
      shell: true,
      stdio: "inherit",
    });
    upstreamChild.on("exit", (code) => {
      if (code && code !== 0) {
        console.error(`上游指令已結束（結束碼 ${code}）`);
      }
      process.exit(code || 0);
    });
    const shutdown = () => {
      if (upstreamChild && !upstreamChild.killed) {
        upstreamChild.kill("SIGTERM");
      }
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  const resolvedAgent = resolveAgentMode(args.agent);
  const server = createProxyServer({
    target,
    store,
    projectDir,
    agent: args.agent,
    agentArgs: args.agentArgs,
  });

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
    console.log(`  專案目錄：${projectDir}`);
    console.log(`  派送模式：${resolvedAgent}（若有對話正在執行 dev-prompt wait 會優先送到該對話）`);
    console.log(`  標註存檔：${store.filePath}`);
    console.log("");
    console.log("提示：點右下角「點選標註」，可先存清單打包送出，也能按「直接送給 Agent」立刻改。");
    console.log("按 Ctrl+C 結束。");
  });
}

main();
