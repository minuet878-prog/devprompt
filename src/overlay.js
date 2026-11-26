(() => {
  const scriptEl = document.currentScript;
  if (!scriptEl || document.getElementById("dev-prompt-host")) {
    return;
  }

  const apiBase = scriptEl.dataset.apiBase || "/__dev-prompt__/items/";

  const host = document.createElement("div");
  host.id = "dev-prompt-host";
  host.setAttribute("data-dev-prompt-ignore", "true");
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "PingFang TC", sans-serif;
        font-size: 16px;
        color: #162235;
      }
      * {
        box-sizing: border-box;
      }
      button, textarea {
        font: inherit;
      }
      [hidden] {
        display: none !important;
      }
      .dp-dock {
        position: fixed;
        right: 0.75rem;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
        z-index: 2147483640;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem;
        border-radius: 999rem;
        background: rgba(22, 34, 53, 0.94);
        box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(8px);
      }
      .dp-btn {
        min-height: 2.5rem;
        padding: 0.45rem 0.85rem;
        border: 0;
        border-radius: 999rem;
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
      }
      .dp-btn-primary {
        background: #2563eb;
        color: #ffffff;
      }
      .dp-btn-secondary {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }
      .dp-btn-ghost {
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        padding: 0.45rem 0.65rem;
      }
      .dp-btn-surface {
        background: #eef2f7;
        color: #162235;
      }
      .dp-btn-danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .dp-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .dp-pill-min {
        position: fixed;
        right: 0.75rem;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
        z-index: 2147483640;
        width: 2.75rem;
        height: 2.75rem;
        border: 0;
        border-radius: 999rem;
        background: rgba(22, 34, 53, 0.86);
        color: #ffffff;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.25);
      }
      .dp-banner {
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483642;
        width: min(calc(100vw - 1.5rem), 32rem);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        border-radius: 0.9rem;
        background: #1f4e8c;
        color: #ffffff;
        box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.28);
      }
      .dp-banner-text {
        font-size: 0.95rem;
        line-height: 1.35;
      }
      .dp-highlight {
        position: fixed;
        z-index: 2147483639;
        pointer-events: none;
        border: 2px solid #2563eb;
        background: rgba(37, 99, 235, 0.14);
        border-radius: 0.35rem;
      }
      .dp-highlight-label {
        position: absolute;
        left: 0;
        bottom: 100%;
        margin-bottom: 0.25rem;
        max-width: min(85vw, 24rem);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0.15rem 0.45rem;
        border-radius: 0.35rem;
        background: #1f4e8c;
        color: #ffffff;
        font-size: 0.85rem;
      }
      .dp-sheet-wrap, .dp-drawer-wrap {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        background: rgba(15, 23, 42, 0.45);
        padding: 0.75rem;
        padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
      }
      .dp-sheet, .dp-drawer {
        width: min(100%, 34rem);
        max-height: 82dvh;
        overflow-y: auto;
        border-radius: 1.1rem;
        background: #ffffff;
        padding: 1rem;
        box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.28);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .dp-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .dp-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .dp-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
      }
      .dp-target-box {
        padding: 0.65rem 0.75rem;
        border-radius: 0.65rem;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .dp-target-meta {
        font-size: 0.9rem;
        color: #334155;
        word-break: break-word;
      }
      .dp-target-selector {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.85rem;
        color: #475569;
        word-break: break-all;
      }
      .dp-textarea {
        width: 100%;
        min-height: 5.5rem;
        padding: 0.75rem;
        border: 1.5px solid #94a3b8;
        border-radius: 0.7rem;
        font-size: 1rem;
        line-height: 1.45;
        color: #0f172a;
        resize: vertical;
      }
      .dp-textarea:focus {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
        border-color: #2563eb;
      }
      .dp-error {
        margin: 0;
        color: #b91c1c;
        font-size: 0.95rem;
      }
      .dp-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .dp-item {
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.75rem;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .dp-badge {
        display: inline-block;
        padding: 0.15rem 0.55rem;
        border-radius: 999rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .dp-badge-open {
        background: #dbeafe;
        color: #1e40af;
      }
      .dp-badge-done {
        background: #dcfce7;
        color: #166534;
      }
      .dp-prompt-text {
        margin: 0;
        font-size: 1rem;
        color: #0f172a;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .dp-resolution {
        margin: 0;
        font-size: 0.9rem;
        color: #166534;
      }
      .dp-empty {
        margin: 0.5rem 0;
        color: #475569;
        font-size: 0.95rem;
      }
      .dp-toast {
        position: fixed;
        left: 50%;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 8.75rem);
        transform: translateX(-50%);
        z-index: 2147483646;
        max-width: min(calc(100vw - 1.5rem), 28rem);
        padding: 0.65rem 1rem;
        border-radius: 0.75rem;
        background: #166534;
        color: #ffffff;
        font-size: 0.95rem;
        text-align: center;
        box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.25);
      }
    </style>

    <div class="dp-highlight" hidden>
      <div class="dp-highlight-label"></div>
    </div>

    <div class="dp-banner" hidden role="status">
      <span class="dp-banner-text">點選畫面上想改的地方（可正常滑動）</span>
      <button type="button" class="dp-btn dp-btn-secondary" data-action="cancel-pick">取消</button>
    </div>

    <div class="dp-dock" aria-label="dev-prompt 開發標註工具">
      <button type="button" class="dp-btn dp-btn-primary" data-action="start-pick">點選標註</button>
      <button type="button" class="dp-btn dp-btn-secondary" data-action="open-drawer">清單 (<span data-count>0</span>)</button>
      <button type="button" class="dp-btn dp-btn-ghost" data-action="minimize" aria-label="暫時收合">收合</button>
    </div>

    <button type="button" class="dp-pill-min" hidden data-action="restore" aria-label="展開開發標註工具">標</button>

    <div class="dp-sheet-wrap" hidden>
      <div class="dp-sheet" role="dialog" aria-modal="true" aria-label="新增畫面修改標註">
        <div class="dp-row">
          <h2 class="dp-title">新增修改標註</h2>
          <button type="button" class="dp-btn dp-btn-surface" data-action="select-parent">改選上一層 ↑</button>
        </div>
        <div class="dp-target-box">
          <div class="dp-target-meta" data-target-meta></div>
          <div class="dp-target-selector" data-target-selector></div>
        </div>
        <textarea class="dp-textarea" data-prompt-input placeholder="輸入想怎麼改（例如：這顆按鈕字太小、跟上面間距拉開一點）"></textarea>
        <p class="dp-error" data-sheet-error hidden></p>
        <div class="dp-row">
          <button type="button" class="dp-btn dp-btn-surface" data-action="close-sheet">取消</button>
          <button type="button" class="dp-btn dp-btn-primary" data-action="submit-prompt">送出標註</button>
        </div>
      </div>
    </div>

    <div class="dp-drawer-wrap" hidden>
      <div class="dp-drawer" role="dialog" aria-modal="true" aria-label="已收集的修改標註">
        <div class="dp-row">
          <h2 class="dp-title">修改標註清單</h2>
          <button type="button" class="dp-btn dp-btn-surface" data-action="close-drawer">關閉</button>
        </div>
        <div class="dp-row">
          <button type="button" class="dp-btn dp-btn-surface" data-action="copy-markdown">複製待處理</button>
          <button type="button" class="dp-btn dp-btn-danger" data-action="clear-all">清空全部</button>
        </div>
        <div class="dp-list" data-list></div>
      </div>
    </div>

    <div class="dp-toast" hidden role="status"></div>
  `;

  document.body.appendChild(host);

  const dock = shadow.querySelector(".dp-dock");
  const minPill = shadow.querySelector(".dp-pill-min");
  const banner = shadow.querySelector(".dp-banner");
  const highlight = shadow.querySelector(".dp-highlight");
  const highlightLabel = shadow.querySelector(".dp-highlight-label");
  const sheetWrap = shadow.querySelector(".dp-sheet-wrap");
  const drawerWrap = shadow.querySelector(".dp-drawer-wrap");
  const targetMeta = shadow.querySelector("[data-target-meta]");
  const targetSelectorEl = shadow.querySelector("[data-target-selector]");
  const promptInput = shadow.querySelector("[data-prompt-input]");
  const sheetError = shadow.querySelector("[data-sheet-error]");
  const submitBtn = shadow.querySelector('[data-action="submit-prompt"]');
  const parentBtn = shadow.querySelector('[data-action="select-parent"]');
  const countEl = shadow.querySelector("[data-count]");
  const listEl = shadow.querySelector("[data-list]");
  const toastEl = shadow.querySelector(".dp-toast");

  let picking = false;
  let selectedEl = null;
  let items = [];
  let toastTimer = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2800);
  }

  function escapeIdent(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) {
      return "";
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (node.id) {
        parts.unshift(`#${escapeIdent(node.id)}`);
        break;
      }
      let part = node.tagName.toLowerCase();
      const classes = Array.from(node.classList || []).filter(Boolean).slice(0, 3);
      if (classes.length) {
        part += "." + classes.map(escapeIdent).join(".");
      }
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
        if (sameTag.length > 1) {
          part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      if (parts.length >= 5) {
        break;
      }
      node = parent;
    }
    return parts.join(" > ");
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const attrs = [];
    for (const name of ["aria-label", "name", "href", "type", "role", "data-testid"]) {
      const val = el.getAttribute(name);
      if (val) {
        attrs.push(`${name}=${val.slice(0, 60)}`);
      }
    }
    return {
      tag,
      text,
      attributes: attrs.join(" | "),
      selector: buildSelector(el),
    };
  }

  function positionHighlight(el) {
    if (!el || !el.getBoundingClientRect) {
      highlight.hidden = true;
      return;
    }
    const rect = el.getBoundingClientRect();
    highlight.style.top = `${Math.max(0, rect.top)}px`;
    highlight.style.left = `${Math.max(0, rect.left)}px`;
    highlight.style.width = `${Math.max(4, rect.width)}px`;
    highlight.style.height = `${Math.max(4, rect.height)}px`;
    const info = describeElement(el);
    highlightLabel.textContent = info.text ? `<${info.tag}> ${info.text.slice(0, 36)}` : `<${info.tag}>`;
    highlight.hidden = false;
  }

  function isOwnNode(target) {
    return target === host || (target instanceof Node && host.contains(target));
  }

  function stopPicking() {
    picking = false;
    banner.hidden = true;
    dock.hidden = false;
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("click", onPickClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function startPicking() {
    picking = true;
    dock.hidden = true;
    minPill.hidden = true;
    drawerWrap.hidden = true;
    sheetWrap.hidden = true;
    banner.hidden = false;
    highlight.hidden = true;
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onPickClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function onPointerMove(event) {
    if (!picking || event.pointerType !== "mouse") {
      return;
    }
    if (isOwnNode(event.target) || !(event.target instanceof Element)) {
      return;
    }
    positionHighlight(event.target);
  }

  function onPickClick(event) {
    if (!picking || isOwnNode(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.target instanceof Element) {
      openSheet(event.target);
    }
    stopPicking();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (picking) {
        stopPicking();
        highlight.hidden = true;
      } else if (!sheetWrap.hidden) {
        closeSheet();
      } else if (!drawerWrap.hidden) {
        drawerWrap.hidden = true;
      }
    }
  }

  function renderTargetInfo() {
    if (!selectedEl) {
      return;
    }
    const info = describeElement(selectedEl);
    const deviceLabel = window.innerWidth < 768 ? "手機" : "電腦";
    const preview = info.text ? `「${info.text.slice(0, 60)}」` : "（無文字內容）";
    targetMeta.textContent = `${deviceLabel} ${window.innerWidth}×${window.innerHeight} · <${info.tag}> ${preview}`;
    targetSelectorEl.textContent = info.selector || `<${info.tag}>`;
    parentBtn.disabled = !selectedEl.parentElement || selectedEl.parentElement === document.body;
    positionHighlight(selectedEl);
  }

  function openSheet(el) {
    selectedEl = el;
    sheetError.hidden = true;
    promptInput.value = "";
    renderTargetInfo();
    sheetWrap.hidden = false;
    document.addEventListener("keydown", onKeyDown, true);
    setTimeout(() => promptInput.focus(), 50);
  }

  function closeSheet() {
    sheetWrap.hidden = true;
    highlight.hidden = true;
    selectedEl = null;
    document.removeEventListener("keydown", onKeyDown, true);
  }

  async function fetchItems() {
    try {
      const res = await fetch(apiBase, { credentials: "same-origin" });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
      updateCount();
      if (!drawerWrap.hidden) {
        renderDrawer();
      }
    } catch {
      // Quietly retry on next drawer open if proxy restarted.
    }
  }

  function updateCount() {
    const openCount = items.filter((item) => item.status !== "done").length;
    countEl.textContent = String(openCount);
    minPill.textContent = openCount > 0 ? String(openCount) : "標";
  }

  async function submitPrompt() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      sheetError.textContent = "請先輸入想修改的內容";
      sheetError.hidden = false;
      promptInput.focus();
      return;
    }
    if (!selectedEl) {
      return;
    }
    submitBtn.disabled = true;
    sheetError.hidden = true;
    const info = describeElement(selectedEl);
    const rect = selectedEl.getBoundingClientRect();
    const payload = {
      url: `${window.location.pathname}${window.location.search}`,
      page_title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      selector: info.selector,
      tag: info.tag,
      text: info.text,
      attributes: info.attributes,
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      prompt,
    };
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        sheetError.textContent = data.error || "送出失敗，請再試一次";
        sheetError.hidden = false;
        return;
      }
      items.push(data.item);
      updateCount();
      closeSheet();
      showToast("已記下標註！回對話說「處理標註」就會改好");
    } catch {
      sheetError.textContent = "連不到 dev-prompt 代理伺服器";
      sheetError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function toggleStatus(item) {
    const nextStatus = item.status === "done" ? "open" : "done";
    try {
      const res = await fetch(`${apiBase}${encodeURIComponent(item.id)}/`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        items = items.map((entry) => (entry.id === item.id ? data.item : entry));
        updateCount();
        renderDrawer();
      }
    } catch {
      showToast("更新狀態失敗");
    }
  }

  async function deleteItem(id) {
    try {
      const res = await fetch(`${apiBase}${encodeURIComponent(id)}/`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        items = items.filter((item) => item.id !== id);
        updateCount();
        renderDrawer();
      }
    } catch {
      showToast("刪除失敗");
    }
  }

  async function clearAll() {
    try {
      const res = await fetch(`${apiBase}clear/`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) {
        items = [];
        updateCount();
        renderDrawer();
        showToast("已清空所有標註");
      }
    } catch {
      showToast("清空失敗");
    }
  }

  function formatMarkdown(list) {
    return list
      .map((item, idx) => {
        const device = item.device === "mobile" ? "手機" : "電腦";
        const width =
          item.viewport && item.viewport.width
            ? `${item.viewport.width}×${item.viewport.height}`
            : "";
        return [
          `${idx + 1}. **${item.url || "/"}**（${device}${width ? ` ${width}` : ""}）`,
          `   - 元件：\`${item.selector || `<${item.tag}>`}\` ${item.text ? `「${item.text}」` : ""}`.trimEnd(),
          `   - 需求：${item.prompt}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  async function copyPendingMarkdown() {
    const openItems = items.filter((item) => item.status !== "done");
    if (!openItems.length) {
      showToast("目前沒有待處理的標註");
      return;
    }
    const text = formatMarkdown(openItems);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      showToast(`已複製 ${openItems.length} 筆待處理標註`);
    } catch {
      showToast("瀏覽器不允許複製，直接回對話說「處理標註」即可");
    }
  }

  function renderDrawer() {
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "dp-empty";
      empty.textContent = "目前還沒有標註。點右下角「點選標註」就能直接在畫面上點選要改的地方。";
      listEl.appendChild(empty);
      return;
    }
    for (const item of [...items].reverse()) {
      const card = document.createElement("div");
      card.className = "dp-item";

      const top = document.createElement("div");
      top.className = "dp-row";

      const badge = document.createElement("span");
      const done = item.status === "done";
      badge.className = `dp-badge ${done ? "dp-badge-done" : "dp-badge-open"}`;
      const device = item.device === "mobile" ? "手機" : "電腦";
      const size = item.viewport && item.viewport.width ? ` ${item.viewport.width}px` : "";
      badge.textContent = `${done ? "已處理" : "待處理"} · ${device}${size}`;

      const actions = document.createElement("div");
      actions.className = "dp-actions";

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "dp-btn dp-btn-surface";
      toggleBtn.textContent = done ? "重開" : "完成";
      toggleBtn.addEventListener("click", () => toggleStatus(item));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "dp-btn dp-btn-surface";
      delBtn.textContent = "刪除";
      delBtn.addEventListener("click", () => deleteItem(item.id));

      actions.append(toggleBtn, delBtn);
      top.append(badge, actions);

      const meta = document.createElement("div");
      meta.className = "dp-target-meta";
      meta.textContent = `${item.url || "/"} · ${item.created_at || ""}`;

      const selector = document.createElement("div");
      selector.className = "dp-target-selector";
      selector.textContent = `${item.selector || `<${item.tag}>`}${item.text ? ` · 「${item.text.slice(0, 40)}」` : ""}`;

      const prompt = document.createElement("p");
      prompt.className = "dp-prompt-text";
      prompt.textContent = item.prompt;

      card.append(top, meta, selector, prompt);
      if (item.resolution) {
        const resNote = document.createElement("p");
        resNote.className = "dp-resolution";
        resNote.textContent = `處理紀錄：${item.resolution}`;
        card.append(resNote);
      }
      listEl.appendChild(card);
    }
  }

  shadow.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!target) {
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "start-pick") {
      startPicking();
    } else if (action === "cancel-pick") {
      stopPicking();
      highlight.hidden = true;
    } else if (action === "minimize") {
      dock.hidden = true;
      minPill.hidden = false;
    } else if (action === "restore") {
      minPill.hidden = true;
      dock.hidden = false;
    } else if (action === "open-drawer") {
      drawerWrap.hidden = false;
      fetchItems();
      renderDrawer();
    } else if (action === "close-drawer") {
      drawerWrap.hidden = true;
    } else if (action === "select-parent") {
      if (selectedEl && selectedEl.parentElement && selectedEl.parentElement !== document.body) {
        selectedEl = selectedEl.parentElement;
        renderTargetInfo();
      }
    } else if (action === "close-sheet") {
      closeSheet();
    } else if (action === "submit-prompt") {
      submitPrompt();
    } else if (action === "copy-markdown") {
      copyPendingMarkdown();
    } else if (action === "clear-all") {
      clearAll();
    }
  });

  sheetWrap.addEventListener("click", (event) => {
    if (event.target === sheetWrap) {
      closeSheet();
    }
  });

  drawerWrap.addEventListener("click", (event) => {
    if (event.target === drawerWrap) {
      drawerWrap.hidden = true;
    }
  });

  promptInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitPrompt();
    }
  });

  fetchItems();
})();
