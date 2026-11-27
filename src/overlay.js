(() => {
  const scriptEl = document.currentScript;
  if (!scriptEl || document.getElementById("dev-prompt-host")) {
    return;
  }

  const apiBase = scriptEl.dataset.apiBase || "/__dev-prompt__/items/";
  const rootBase = apiBase.replace(/items\/?$/, "");

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
      .dp-btn-success {
        background: #15803d;
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
        max-height: 85dvh;
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
        flex-wrap: wrap;
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
      .dp-status-card {
        padding: 0.75rem;
        border-radius: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.95rem;
      }
      .dp-status-running {
        background: #eff6ff;
        border: 1px solid #93c5fd;
        color: #1e3a8a;
      }
      .dp-status-done {
        background: #f0fdf4;
        border: 1px solid #86efac;
        color: #14532d;
      }
      .dp-status-error {
        background: #fef2f2;
        border: 1px solid #fca5a5;
        color: #991b1b;
      }
      .dp-status-summary {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.9rem;
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
      .dp-badge-processing {
        background: #fef3c7;
        color: #92400e;
      }
      .dp-section-title {
        margin: 0.5rem 0 0;
        padding-top: 0.5rem;
        border-top: 1px solid #cbd5e1;
        font-size: 1rem;
        font-weight: 700;
        color: #92400e;
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
      .dp-done {
        margin-top: 0.35rem;
        padding-top: 0.3rem;
        border-top: 1px solid #cbd5e1;
      }
      .dp-done > summary {
        min-height: 2.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        font-weight: 700;
        color: #166534;
        list-style: none;
      }
      .dp-done > summary::-webkit-details-marker {
        display: none;
      }
      .dp-done > summary::before {
        content: "▸";
      }
      .dp-done[open] > summary::before {
        content: "▾";
      }
      .dp-done > .dp-item {
        margin-top: 0.65rem;
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
      <span class="dp-banner-text">點選畫面上想改的地方，可以連續點好幾個（可正常滑動）</span>
      <button type="button" class="dp-btn dp-btn-secondary" data-action="cancel-pick">結束標註</button>
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
          <div class="dp-actions">
            <button type="button" class="dp-btn dp-btn-surface" data-action="save-only">先存清單</button>
            <button type="button" class="dp-btn dp-btn-primary" data-action="save-and-send">直接送給 Agent</button>
          </div>
        </div>
      </div>
    </div>

    <div class="dp-drawer-wrap" hidden>
      <div class="dp-drawer" role="dialog" aria-modal="true" aria-label="已收集的修改標註">
        <div class="dp-row">
          <h2 class="dp-title">修改標註清單</h2>
          <button type="button" class="dp-btn dp-btn-surface" data-action="close-drawer">關閉</button>
        </div>
        <div class="dp-status-card" data-status-card hidden></div>
        <div class="dp-row">
          <button type="button" class="dp-btn dp-btn-primary" data-action="dispatch-all">整理並送給 Agent</button>
          <div class="dp-actions">
            <button type="button" class="dp-btn dp-btn-surface" data-action="copy-prompt">複製 Prompt</button>
            <button type="button" class="dp-btn dp-btn-danger" data-action="clear-all">清空</button>
          </div>
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
  const saveOnlyBtn = shadow.querySelector('[data-action="save-only"]');
  const saveSendBtn = shadow.querySelector('[data-action="save-and-send"]');
  const dispatchAllBtn = shadow.querySelector('[data-action="dispatch-all"]');
  const statusCard = shadow.querySelector("[data-status-card]");
  const parentBtn = shadow.querySelector('[data-action="select-parent"]');
  const countEl = shadow.querySelector("[data-count]");
  const listEl = shadow.querySelector("[data-list]");
  const toastEl = shadow.querySelector(".dp-toast");

  let picking = false;
  // On from 點選標註 until 結束標註 or Esc: each saved or cancelled note goes back to picking.
  let annotating = false;
  let selectedEl = null;
  let items = [];
  let doneOpen = false;
  let dispatchInfo = { job: { status: "idle" }, dispatch_mode: "auto", has_waiter: false };
  let toastTimer = null;
  let pollTimer = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
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
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("click", onPickClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function endAnnotating() {
    annotating = false;
    stopPicking();
    highlight.hidden = true;
    dock.hidden = false;
  }

  function startPicking() {
    annotating = true;
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
    // Stop first: stopPicking drops the Esc listener that openSheet adds.
    stopPicking();
    if (event.target instanceof Element) {
      openSheet(event.target);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (picking) {
        endAnnotating();
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
    if (annotating) {
      startPicking();
    } else {
      dock.hidden = false;
    }
  }

  const statusOf = (item) => item.status || "open";

  function updateCount() {
    const openCount = items.filter((item) => statusOf(item) === "open").length;
    const isRunning = dispatchInfo.job && dispatchInfo.job.status === "running";
    countEl.textContent = isRunning ? "改中" : String(openCount);
    minPill.textContent = isRunning ? "…" : openCount > 0 ? String(openCount) : "標";
    dispatchAllBtn.disabled = isRunning || openCount === 0;
    dispatchAllBtn.textContent = isRunning
      ? "Agent 修改中…"
      : `整理並送給 Agent${openCount > 0 ? ` (${openCount})` : ""}`;
  }

  function renderStatusCard() {
    const job = dispatchInfo.job;
    if (!job || job.status === "idle") {
      statusCard.hidden = true;
      return;
    }
    statusCard.hidden = false;
    statusCard.innerHTML = "";

    const header = document.createElement("div");
    header.className = "dp-row";
    const title = document.createElement("strong");

    if (job.status === "running") {
      statusCard.className = "dp-status-card dp-status-running";
      title.textContent = `Agent（${job.mode}）正在修改中…`;
      header.append(title);
      statusCard.append(header);
      return;
    }

    // Queued and handed off mean nothing has changed yet, so neither offers a reload.
    if (job.status === "queued" || job.status === "handed_off") {
      statusCard.className = "dp-status-card dp-status-running";
      title.textContent =
        job.status === "queued" ? "已排隊，等 Agent 對話來拿" : "已送到你開著的 Agent 對話";
      header.append(title);
      statusCard.append(header);
      if (job.summary) {
        const p = document.createElement("p");
        p.className = "dp-status-summary";
        p.textContent = job.summary;
        statusCard.append(p);
      }
      return;
    }

    if (job.status === "done") {
      statusCard.className = "dp-status-card dp-status-done";
      title.textContent = "Agent 已修改完成！";
      const reloadBtn = document.createElement("button");
      reloadBtn.type = "button";
      reloadBtn.className = "dp-btn dp-btn-success";
      reloadBtn.textContent = "重新整理看結果";
      reloadBtn.addEventListener("click", () => window.location.reload());
      header.append(title, reloadBtn);
      statusCard.append(header);
      if (job.summary) {
        const p = document.createElement("p");
        p.className = "dp-status-summary";
        p.textContent = job.summary;
        statusCard.append(p);
      }
      return;
    }

    statusCard.className = "dp-status-card dp-status-error";
    title.textContent = "送給 Agent 失敗";
    header.append(title);
    statusCard.append(header);
    if (job.error) {
      const p = document.createElement("p");
      p.className = "dp-status-summary";
      p.textContent = job.error;
      statusCard.append(p);
    }
  }

  function schedulePollIfRunning() {
    clearTimeout(pollTimer);
    const status = dispatchInfo.job && dispatchInfo.job.status;
    const jobActive = status === "running" || status === "queued";
    // Items sent to a conversation stay 處理中 until it runs `dev-prompt done`; keep checking.
    const hasProcessing = items.some((item) => statusOf(item) === "processing");
    if (jobActive || hasProcessing) {
      pollTimer = setTimeout(async () => {
        const prevStatus = dispatchInfo.job.status;
        await fetchItems();
        if (prevStatus === "running" && dispatchInfo.job.status === "done") {
          showToast("Agent 已改好！點開清單或直接重新整理看結果");
        } else if (prevStatus === "running" && dispatchInfo.job.status === "error") {
          showToast("Agent 執行失敗，請打開清單查看原因");
        } else if (prevStatus === "queued" && dispatchInfo.job.status === "handed_off") {
          showToast("Agent 對話已經收到了");
        }
        schedulePollIfRunning();
      }, jobActive ? 1500 : 4000);
    }
  }

  async function fetchItems() {
    try {
      const res = await fetch(apiBase, { credentials: "same-origin" });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
      if (data.job) {
        dispatchInfo = {
          job: data.job,
          dispatch_mode: data.dispatch_mode,
          has_waiter: Boolean(data.has_waiter),
        };
      }
      updateCount();
      renderStatusCard();
      if (!drawerWrap.hidden) {
        renderDrawer();
      }
    } catch {
      // Quietly retry on next action if proxy restarted.
    }
  }

  async function dispatchToAgent(itemIds = null) {
    try {
      const res = await fetch(`${rootBase}dispatch/`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemIds ? { item_ids: itemIds } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "送給 Agent 失敗");
        return false;
      }
      dispatchInfo.job = data.job;
      // The sent items are now 處理中 on the server; pull them so the list and count follow.
      await fetchItems();
      schedulePollIfRunning();
      if (data.job.status === "handed_off") {
        showToast("已整理成 Prompt 並送給 Agent！");
      } else if (data.job.status === "queued") {
        showToast("已排隊，Agent 對話一開始等就會收到");
      } else {
        showToast("已整理成 Prompt，Agent 開始修改中…");
      }
      return true;
    } catch {
      showToast("連不到 dev-prompt 代理伺服器");
      return false;
    }
  }

  async function submitPrompt(sendImmediately) {
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
    saveOnlyBtn.disabled = true;
    saveSendBtn.disabled = true;
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
      if (sendImmediately) {
        const ok = await dispatchToAgent([data.item.id]);
        if (!ok) {
          endAnnotating();
          drawerWrap.hidden = false;
          renderDrawer();
        }
      } else {
        showToast("已存進清單，可以接著點下一個");
      }
    } catch {
      sheetError.textContent = "連不到 dev-prompt 代理伺服器";
      sheetError.hidden = false;
    } finally {
      saveOnlyBtn.disabled = false;
      saveSendBtn.disabled = false;
    }
  }

  async function setItemStatus(item, nextStatus) {
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

  async function copyOrganizedPrompt() {
    try {
      const res = await fetch(`${rootBase}prompt-preview/`, { credentials: "same-origin" });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      if (!data.prompt) {
        showToast("目前沒有待處理的標註");
        return;
      }
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(data.prompt);
      } else {
        const area = document.createElement("textarea");
        area.value = data.prompt;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      showToast(`已複製整理好的完整 Prompt（${data.open_count} 筆）`);
    } catch {
      showToast("複製失敗，請確認代理伺服器仍在執行");
    }
  }

  // Open items on top, newest first, then the ones an agent is working on;
  // done ones fold away under 已完成 so the list does not pile up.
  function renderDrawer() {
    renderStatusCard();
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "dp-empty";
      empty.textContent = "目前還沒有標註。點右下角「點選標註」就能直接在畫面上點選要改的地方。";
      listEl.appendChild(empty);
      return;
    }
    const newestFirst = [...items].reverse();
    const openItems = newestFirst.filter((item) => statusOf(item) === "open");
    const processingItems = newestFirst.filter((item) => statusOf(item) === "processing");
    const doneItems = newestFirst.filter((item) => statusOf(item) === "done");
    if (!openItems.length) {
      const empty = document.createElement("p");
      empty.className = "dp-empty";
      empty.textContent = "目前沒有待處理的標註。";
      listEl.appendChild(empty);
    }
    for (const item of openItems) {
      listEl.appendChild(makeCard(item));
    }
    if (processingItems.length) {
      const heading = document.createElement("p");
      heading.className = "dp-section-title";
      heading.textContent = `處理中（${processingItems.length}）`;
      listEl.appendChild(heading);
      for (const item of processingItems) {
        listEl.appendChild(makeCard(item));
      }
    }
    if (doneItems.length) {
      const section = document.createElement("details");
      section.className = "dp-done";
      // The list redraws while a send is polled; keep the section as the person left it.
      section.open = doneOpen;
      section.addEventListener("toggle", () => {
        doneOpen = section.open;
      });
      const summary = document.createElement("summary");
      summary.textContent = `已完成（${doneItems.length}）`;
      section.append(summary, ...doneItems.map(makeCard));
      listEl.appendChild(section);
    }
  }

  function makeCard(item) {
    const card = document.createElement("div");
    card.className = "dp-item";

    const top = document.createElement("div");
    top.className = "dp-row";

    const badge = document.createElement("span");
    const status = statusOf(item);
    const badgeLook = {
      open: ["dp-badge-open", "待處理"],
      processing: ["dp-badge-processing", "處理中"],
      done: ["dp-badge-done", "已處理"],
    }[status] || ["dp-badge-open", "待處理"];
    badge.className = `dp-badge ${badgeLook[0]}`;
    const device = item.device === "mobile" ? "手機" : "電腦";
    const size = item.viewport && item.viewport.width ? ` ${item.viewport.width}px` : "";
    badge.textContent = `${badgeLook[1]} · ${device}${size}`;

    const actions = document.createElement("div");
    actions.className = "dp-actions";

    const makeButton = (label, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dp-btn dp-btn-surface";
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      return btn;
    };

    if (status === "done") {
      actions.append(makeButton("重開", () => setItemStatus(item, "open")));
    } else {
      actions.append(makeButton("完成", () => setItemStatus(item, "done")));
    }
    if (status === "processing") {
      // For when the agent never got to it: put it back so the next send includes it.
      actions.append(makeButton("退回", () => setItemStatus(item, "open")));
    }
    actions.append(makeButton("刪除", () => deleteItem(item.id)));
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
    return card;
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
      endAnnotating();
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
    } else if (action === "save-only") {
      submitPrompt(false);
    } else if (action === "save-and-send") {
      submitPrompt(true);
    } else if (action === "dispatch-all") {
      dispatchToAgent(null);
    } else if (action === "copy-prompt") {
      copyOrganizedPrompt();
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
      submitPrompt(true);
    }
  });

  fetchItems().then(schedulePollIfRunning);
})();
