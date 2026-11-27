import { spawn } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";

import { buildAgentPrompt } from "./prompt-builder.mjs";

// "conversation" never starts an agent of its own: a send waits for whichever
// conversation runs `dev-prompt wait` (Claude Code, Codex, Antigravity...).
// An installed CLI such as agy runs only when asked for by name.
export function resolveAgentMode(requested = "auto", env = process.env) {
  if (requested === "none") {
    return "conversation";
  }
  if (requested && requested !== "auto") {
    return requested;
  }
  if (env.ANTIGRAVITY_LS_ADDRESS && env.ANTIGRAVITY_CSRF_TOKEN) {
    return "antigravity-app";
  }
  return "conversation";
}

function summarizeOutput(text) {
  const cleaned = String(text || "").trim();
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim());
  const tail = lines.slice(-6).join("\n");
  return tail.length > 420 ? `${tail.slice(0, 417)}...` : tail;
}

function postJson(urlString, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(text || "{}"));
            } catch {
              resolve({ raw: text });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end(payload);
  });
}

export class AgentDispatcher {
  constructor({
    store,
    projectDir = process.cwd(),
    targetUrl = "",
    agent = "auto",
    agentArgs = [],
    env = process.env,
  }) {
    this.store = store;
    this.projectDir = projectDir;
    this.targetUrl = targetUrl;
    this.agent = resolveAgentMode(agent, env);
    this.agentArgs = Array.isArray(agentArgs) ? agentArgs : [];
    this.env = env;
    this.waiters = new Set();
    this.pending = null;
    this.currentJob = {
      id: null,
      status: "idle",
      mode: this.agent,
      item_ids: [],
      prompt: "",
      summary: "",
      error: "",
      started_at: null,
      finished_at: null,
    };
  }

  getStatus() {
    return {
      job: { ...this.currentJob },
      dispatch_mode: this.agent,
      has_waiter: this.waiters.size > 0,
    };
  }

  registerWaiter(resolveFn) {
    if (this.pending) {
      const payload = this.pending;
      this.pending = null;
      this._handOff([resolveFn], payload);
      return () => {};
    }
    this.waiters.add(resolveFn);
    return () => {
      this.waiters.delete(resolveFn);
    };
  }

  _handOff(listeners, payload) {
    for (const resolveFn of listeners) {
      resolveFn(payload);
    }
    const now = new Date().toISOString();
    this.currentJob = {
      id: payload.job_id,
      status: "handed_off",
      mode: "active-conversation",
      item_ids: payload.item_ids,
      prompt: payload.prompt,
      summary: `已將 ${payload.item_ids.length} 筆整理好的 Prompt 送到目前對話中的 Agent，請在對話視窗查看修改進度。`,
      error: "",
      started_at: now,
      finished_at: now,
    };
  }

  // Only items still waiting to be sent: processing ones already went to an agent.
  buildPreview(itemIds = null) {
    const all = this.store.load();
    const isOpen = (item) => (item.status || "open") === "open";
    const selected =
      Array.isArray(itemIds) && itemIds.length
        ? all.filter((item) => itemIds.includes(item.id) && isOpen(item))
        : all.filter(isOpen);
    return {
      items: selected,
      prompt: this._buildPrompt(selected),
    };
  }

  _buildPrompt(items) {
    return buildAgentPrompt({
      items,
      projectDir: this.projectDir,
      targetUrl: this.targetUrl,
    });
  }

  dispatch(itemIds = null) {
    if (this.currentJob.status === "running") {
      const err = new Error("Agent 正在處理上一批標註，請稍候完成再送出");
      err.statusCode = 409;
      throw err;
    }

    const { items: picked } = this.buildPreview(itemIds);
    if (!picked.length) {
      const err = new Error("目前沒有待處理的標註可送出");
      err.statusCode = 400;
      throw err;
    }

    // A send still waiting in the queue is replaced by this one, so carry its items along.
    const carried = this.pending ? this.pending.item_ids : [];
    const ids = [...new Set([...carried, ...picked.map((item) => item.id)])];
    this.store.setStatusMany(ids, "processing", ["open"]);
    const items = this.store.load().filter((item) => ids.includes(item.id) && item.status !== "done");
    const prompt = this._buildPrompt(items);

    const jobId = crypto.randomBytes(4).toString("hex");
    const now = new Date().toISOString();
    const payload = {
      job_id: jobId,
      mode: "active-conversation",
      item_ids: ids,
      items,
      prompt,
    };

    if (this.waiters.size > 0) {
      const listeners = [...this.waiters];
      this.waiters.clear();
      this._handOff(listeners, payload);
      return { job: { ...this.currentJob }, prompt };
    }

    if (this.agent === "conversation") {
      this.pending = payload;
      this.currentJob = {
        id: jobId,
        status: "queued",
        mode: this.agent,
        item_ids: ids,
        prompt,
        summary: "還沒有對話在等。請在你開著的 Agent 對話裡跑 dev-prompt wait，它一開始等就會收到。",
        error: "",
        started_at: now,
        finished_at: null,
      };
      return { job: { ...this.currentJob }, prompt };
    }

    this.currentJob = {
      id: jobId,
      status: "running",
      mode: this.agent,
      item_ids: ids,
      prompt,
      summary: "",
      error: "",
      started_at: now,
      finished_at: null,
    };

    this._runInBackground(jobId, ids, prompt);
    return { job: { ...this.currentJob }, prompt };
  }

  async _runInBackground(jobId, ids, prompt) {
    try {
      let summary = "";
      if (this.agent === "antigravity-app") {
        summary = await this._dispatchToAntigravityApp(ids, prompt);
      } else {
        summary = await this._spawnAgentProcess(prompt);
      }
      const shortNote = summary.split(/\r?\n/)[0].slice(0, 120) || "Agent 已完成修改";
      if (this.agent !== "antigravity-app") {
        for (const id of ids) {
          this.store.updateStatus(id, "done", shortNote);
        }
      }
      if (this.currentJob.id === jobId) {
        this.currentJob = {
          ...this.currentJob,
          status: this.agent === "antigravity-app" ? "handed_off" : "done",
          summary,
          finished_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      // Nothing was handed over, so the items go back to waiting for a send.
      this.store.setStatusMany(ids, "open", ["processing"]);
      if (this.currentJob.id === jobId) {
        this.currentJob = {
          ...this.currentJob,
          status: "error",
          error: err.message || "Agent 執行失敗",
          finished_at: new Date().toISOString(),
        };
      }
    }
  }

  async _dispatchToAntigravityApp(ids, prompt) {
    const address = this.env.ANTIGRAVITY_LS_ADDRESS;
    const token = this.env.ANTIGRAVITY_CSRF_TOKEN;
    if (!address || !token) {
      throw new Error("缺少 ANTIGRAVITY_LS_ADDRESS 或 ANTIGRAVITY_CSRF_TOKEN 環境變數");
    }
    const body = {
      title: `畫面修改標註（${ids.length} 筆）`,
      tags: ["dev-prompt"],
      prompt: [{ text: prompt }],
    };
    if (this.env.ANTIGRAVITY_PROJECT_ID) {
      body.projectId = this.env.ANTIGRAVITY_PROJECT_ID;
    }
    const result = await postJson(
      `http://${address}/product.v1.ConversationService/CreateConversation`,
      {
        "Connect-Protocol-Version": "1",
        "x-antigravity-csrf-token": token,
      },
      body
    );
    const convId = result?.conversation?.id || "";
    return convId
      ? `已送到 Antigravity App 新對話（${convId.slice(0, 8)}），Agent 正在處理中！`
      : "已送到 Antigravity App，Agent 正在處理中！";
  }

  _spawnAgentProcess(prompt) {
    return new Promise((resolve, reject) => {
      let command;
      let args;
      let useShell = false;
      let writeToStdin = false;

      if (this.agent === "agy") {
        command = "agy";
        args = ["-p", prompt, "--mode", "accept-edits", ...this.agentArgs];
      } else if (this.agent === "claude") {
        command = "claude";
        args = ["-p", prompt, "--permission-mode", "acceptEdits", ...this.agentArgs];
      } else {
        command = this.agent;
        args = [];
        useShell = true;
        writeToStdin = true;
      }

      const child = spawn(command, args, {
        cwd: this.projectDir,
        env: this.env,
        shell: useShell,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdout = [];
      const stderr = [];
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.on("error", (err) => reject(new Error(`無法啟動 ${command}：${err.message}`)));
      child.on("close", (code) => {
        const outText = Buffer.concat(stdout).toString("utf8");
        const errText = Buffer.concat(stderr).toString("utf8");
        if (code === 0 && !outText.trim()) {
          // agy -p exits 0 and prints nothing when a tool call it needs is denied,
          // so a silent run is no proof that anything changed.
          reject(new Error(`${command} 結束了但沒有回報任何結果，標註保持未處理，請到專案確認有沒有改動`));
        } else if (code === 0) {
          resolve(summarizeOutput(outText));
        } else {
          reject(
            new Error(
              `${command} 結束碼 ${code}${errText ? `：${errText.trim().slice(0, 240)}` : ""}`
            )
          );
        }
      });

      if (writeToStdin) {
        child.stdin.write(prompt);
      }
      child.stdin.end();
    });
  }
}
