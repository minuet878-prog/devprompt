import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_PROMPT_LENGTH = 2000;
const MAX_FIELD_LENGTH = 500;

export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cleanText(value, limit = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, limit);
}

function cleanIntDict(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result = {};
  for (const key of keys) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) {
      result[key] = Math.round(value[key]);
    }
  }
  return result;
}

export class PromptStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(items) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = path.join(dir, `.dev-prompts.${crypto.randomBytes(4).toString("hex")}.tmp`);
    const payload = `${JSON.stringify(items, null, 2)}\n`;
    try {
      fs.writeFileSync(tmpPath, payload, "utf8");
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
      throw err;
    }
  }

  add(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("資料格式不正確");
    }
    const prompt = cleanText(input.prompt, MAX_PROMPT_LENGTH);
    if (!prompt) {
      throw new Error("請輸入想修改的內容");
    }
    const viewport = cleanIntDict(input.viewport, ["width", "height"]);
    const width = viewport.width || 0;
    const item = {
      id: crypto.randomBytes(4).toString("hex"),
      created_at: formatTimestamp(),
      status: "open",
      target: cleanText(input.target),
      url: cleanText(input.url),
      page_title: cleanText(input.page_title),
      viewport,
      device: width > 0 && width < 768 ? "mobile" : "desktop",
      selector: cleanText(input.selector),
      tag: cleanText(input.tag, 40),
      text: cleanText(input.text, 200),
      attributes: cleanText(input.attributes, 200),
      rect: cleanIntDict(input.rect, ["top", "left", "width", "height"]),
      prompt,
    };
    const items = this.load();
    items.push(item);
    this.save(items);
    return item;
  }

  updateStatus(id, status, resolution = "") {
    if (status !== "open" && status !== "done") {
      throw new Error("狀態只能是 open 或 done");
    }
    const items = this.load();
    let updated = null;
    for (const item of items) {
      if (item.id === id) {
        item.status = status;
        if (resolution) {
          item.resolution = cleanText(resolution, 500);
        } else if (status === "open") {
          delete item.resolution;
        }
        updated = item;
        break;
      }
    }
    if (!updated) {
      return null;
    }
    this.save(items);
    return updated;
  }

  markDone(idOrAll, resolution = "") {
    const items = this.load();
    let count = 0;
    for (const item of items) {
      if (idOrAll === "all" ? item.status !== "done" : item.id === idOrAll) {
        item.status = "done";
        if (resolution) {
          item.resolution = cleanText(resolution, 500);
        }
        count += 1;
      }
    }
    if (count > 0) {
      this.save(items);
    }
    return count;
  }

  remove(id) {
    const items = this.load();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) {
      return false;
    }
    this.save(next);
    return true;
  }

  clear() {
    this.save([]);
  }
}

export function formatMarkdown(items) {
  const openItems = items.filter((item) => item.status !== "done");
  if (!openItems.length) {
    return "目前沒有待處理的標註。\n";
  }
  return (
    openItems
      .map((item, idx) => {
        const device = item.device === "mobile" ? "手機" : "電腦";
        const size =
          item.viewport && item.viewport.width
            ? `${item.viewport.width}×${item.viewport.height}`
            : "";
        const targetText = item.text ? `「${item.text}」` : "";
        const attrs = item.attributes ? `\n   - 屬性：\`${item.attributes}\`` : "";
        return [
          `${idx + 1}. **${item.url || "/"}**（${device}${size ? ` ${size}` : ""}） \`#${item.id}\``,
          `   - 元件：\`${item.selector || `<${item.tag || "element"}>`}\` ${targetText}`.trimEnd() +
            attrs,
          `   - 需求：${item.prompt}`,
        ].join("\n");
      })
      .join("\n\n") + "\n"
  );
}
