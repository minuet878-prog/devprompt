# dev-prompt

跨框架、零外部套件依賴的本機反向代理標註與 Agent 自動派送工具。  
不論你的專案是 **Django、React/Vite、Next.js、FastAPI、靜態網頁，還是線上網站**，也不論你是用**電腦 Chrome／Safari、實體手機（iPhone／Android）、Antigravity 內建瀏覽器，還是 Claude Desktop 內建預覽窗格**，都能直接點畫面上的元素，自動整理成結構化 Prompt 並交給 Agent 修改。

## 核心能力

- **跨瀏覽器／跨裝置／跨框架**：靠反向代理自動注入浮動標註工具，原專案一行程式碼都不用改。
- **兩用觸發模式**：
  - **先存清單**：一次逛完多個頁面標好 3～5 處，再點清單裡的 **「整理並送給 Agent」** 打包一次改。
  - **直接送給 Agent**：只想改一處時，點 **「直接送給 Agent」** 立即整理並開改。
- **自動整理成工程 Prompt**：依頁面分組，自動附上裝置與螢幕寬度（手機／電腦）、CSS 選擇器、元件文字、屬性、畫面座標與專案規範提醒。
- **自動銜接正在對話的 Agent 或背景 Agent**：
  1. 若有對話正在執行 `dev-prompt wait`，送出後**直接喚醒原本那個對話**（保留完整上下文！）。
  2. 若沒有對話在等，依 `--agent` 自動派送：
     - `antigravity-app`：在 Antigravity App 環境裡直接建立新對話並開始執行。
     - `agy`：透過 Antigravity CLI（`agy -p --mode accept-edits`）在背景修改，改完在手機／瀏覽器顯示摘要與「重新整理看結果」按鈕。
     - `claude`：透過 Claude Code CLI（`claude -p --permission-mode acceptEdits`）在背景修改。
     - 自訂指令：任何 CLI（例如 `codex`）都能從標準輸入接收整理好的 Prompt。

---

## 安裝（只需做一次）

```bash
cd /Users/huangweizhe/dev-prompt
npm link
```

（若不想全域安裝，直接執行 `node /Users/huangweizhe/dev-prompt/bin/dev-prompt.mjs` 即可。）

---

## 整合到你的日常開發流程

### 1. 整合進 Antigravity（App 內建瀏覽器／Chrome／手機皆可用）

在任何專案開發完、進入本機驗證時：

1. 啟動代理（把目標指到你正在跑的開發伺服器，例如 `8000`）：
   ```bash
   dev-prompt http://127.0.0.1:8000 --project /Users/huangweizhe/HearWell
   ```
2. 你可以用 **任何一種瀏覽器** 開啟驗證網址：
   - 電腦 Chrome／Safari：`http://127.0.0.1:8787`
   - 手機（同 Wi-Fi）：`http://<終端顯示的電腦IP>:8787`
   - Antigravity 內建瀏覽器：直接請 AI 用 `/browser` 開 `http://127.0.0.1:8787`
3. 點完標註按下 **「整理並送給 Agent」**（或 **「直接送給 Agent」**）：
   - 若你在對話中請 AI 先跑背景指令 `dev-prompt wait --port 8787`，標註會**直接送回你原本正在聊的那個 Antigravity 對話**！
   - 若沒跑 `wait`，會自動用 `antigravity-app`（在 Antigravity 視窗內）或 `agy` CLI 開始改，改好後瀏覽器與手機會跳出 **「Agent 已修改完成！點此重新整理看結果」**。

### 2. 整合進 Claude Desktop（內建預覽窗格自動附帶標註工具）

想讓 Claude Desktop 點「預覽」時自動開啟帶有標註工具的頁面，只要把專案的 `.claude/launch.json` 透過 `--exec` 包一層即可（範例）：

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "hearwell-with-prompt",
      "runtimeExecutable": "node",
      "runtimeArgs": [
        "/Users/huangweizhe/dev-prompt/bin/dev-prompt.mjs",
        "http://127.0.0.1:8001",
        "--port", "8787",
        "--project", "/Users/huangweizhe/HearWell",
        "--agent", "claude",
        "--exec", "py313/bin/python manage.py runserver 8001"
      ],
      "port": 8787,
      "autoPort": false
    }
  ]
}
```

這樣每次在 Claude Desktop 啟動預覽：
- Claude Desktop 內建預覽開 `http://127.0.0.1:8787`，右下角**自動出現「點選標註」**。
- 你也可以同時用電腦 Chrome 或手機連 `http://<電腦IP>:8787`。
- 如果希望直接回傳到目前 Claude Desktop 的對話，讓 Claude 在驗收前背景跑一行 `dev-prompt wait --port 8787` 即可！

### 3. 讓 AI 每次叫你本地驗證時「自動走這個流程」（全域規則範本）

只要把以下這幾行加進你的全域規則（Antigravity 全域規則或 `~/.claude/CLAUDE.md`），之後不論在哪個專案，AI 做完功能要你本地驗證時都會自動配合：

```markdown
## 本地驗證與畫面標註（dev-prompt）
- 當你完成畫面改動、要請我在本地驗證時：
  1. 確認本機代理 `http://127.0.0.1:8787` 是否已開啟（沒開時提醒我執行 `dev-prompt <目標網址> --project <專案路徑>`，或依專案規則啟動）。
  2. 提供給我本機驗證網址 `http://127.0.0.1:8787`（以及手機同 Wi-Fi 的區網網址），必要時可先在背景執行 `dev-prompt wait --port 8787` 等待我從瀏覽器或手機送出標註。
  3. 收到整理後的標註 Prompt 後，直接依內容修改程式、建置前端資源，完成後執行 `dev-prompt done all --project <專案路徑>` 並提醒我重新整理畫面。
```

---

## 常用指令

```bash
dev-prompt http://127.0.0.1:8000 --project ~/HearWell        # 啟動代理（自動選 agent）
dev-prompt http://localhost:5173 --agent agy                 # 指定用 Antigravity CLI
dev-prompt http://localhost:3000 --agent claude              # 指定用 Claude Code CLI
dev-prompt wait --port 8787                                  # 讓目前對話等待瀏覽器送出 Prompt
dev-prompt prompt --project ~/HearWell                       # 印出整理後的完整 Prompt
dev-prompt list --project ~/HearWell                         # 查看待處理標註清單
dev-prompt done all --project ~/HearWell                     # 將全部標註標記為完成
dev-prompt clear --project ~/HearWell                        # 清空標註清單
```

## 執行測試

```bash
npm test
```
