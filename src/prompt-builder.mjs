export function buildAgentPrompt({ items, projectDir = "", targetUrl = "" }) {
  const openItems = items.filter((item) => item.status !== "done");
  if (!openItems.length) {
    return "";
  }

  const byUrl = new Map();
  for (const item of openItems) {
    const key = item.url || "/";
    if (!byUrl.has(key)) {
      byUrl.set(key, []);
    }
    byUrl.get(key).push(item);
  }

  const lines = [
    "以下是我在瀏覽器驗證畫面時標註的修改需求，請依序協助修改：",
    "",
  ];
  if (projectDir) {
    lines.push(`- 專案目錄：\`${projectDir}\``);
  }
  if (targetUrl) {
    lines.push(`- 驗證網址：\`${targetUrl}\``);
  }
  lines.push(`- 待處理標註：共 ${openItems.length} 筆`);

  let index = 1;
  for (const [url, group] of byUrl.entries()) {
    const title = group.find((entry) => entry.page_title)?.page_title;
    lines.push("");
    lines.push(`### 頁面：\`${url}\`${title ? `（${title}）` : ""}`);
    lines.push("");
    for (const item of group) {
      const device = item.device === "mobile" ? "手機" : "電腦";
      const size =
        item.viewport && item.viewport.width
          ? `${item.viewport.width}×${item.viewport.height}`
          : "";
      lines.push(`${index}. **標註 \`#${item.id}\`**（${device}${size ? ` ${size}` : ""}）`);
      lines.push(
        `   - 目標元件：\`${item.selector || `<${item.tag || "element"}>`}\`${item.tag ? `（\`<${item.tag}>\`）` : ""}`
      );
      if (item.text) {
        lines.push(`   - 元件文字：「${item.text}」`);
      }
      if (item.attributes) {
        lines.push(`   - 元件屬性：\`${item.attributes}\``);
      }
      if (item.rect && Number.isFinite(item.rect.width)) {
        lines.push(
          `   - 畫面位置：\`top=${item.rect.top}, left=${item.rect.left}, width=${item.rect.width}, height=${item.rect.height}\``
        );
      }
      lines.push(`   - **修改需求**：${item.prompt}`);
      index += 1;
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("處理要求：");
  lines.push("1. 請先確認專案的規範與現有架構，找出對應的模板、元件或樣式檔進行精準修改。");
  lines.push("2. 若改動到需要建置的前端資源（如 CSS／JS），請一併執行建置與相關測試。");
  lines.push("3. 完成後請簡要列出修改了哪些檔案與調整內容，方便我重新整理畫面驗證。");

  return `${lines.join("\n")}\n`;
}
