# dev-prompt

跨框架、零外部套件依賴的本機反向代理標註工具。  
不論你的專案是 **Django、React/Vite、Next.js、FastAPI、靜態網頁，還是已經上線的網站**，也不論你是用**電腦 Chrome／Safari** 還是**實體手機（iPhone Safari／Android Chrome）**，都能直接點畫面上的元素打字送出修改 prompt，讓 AI 編程代理（Antigravity、Claude Code、Codex）直接照著改。

## 為什麼這樣設計？

- **零侵入原專案**：靠反向代理在網頁經過時自動注入浮動標註介面，原專案一行程式碼都不用改。
- **手機免改專案設定**：只要原本的 `runserver` 照常跑在 `127.0.0.1:8000`，`dev-prompt` 會自動把同 Wi-Fi 手機連進來的請求轉發給它，並處理 `Host`、`Origin`、`Referer`、`Set-Cookie` 與重定向，Django 登入與表單 CSRF 也能直接運作。
- **相容嚴格 CSP**：自動偵測原網頁的 `Content-Security-Policy`（包含 `nonce`），不破壞原網站安全設定。
- **支援 WebSocket**：Vite / Next.js 的即時重載連線可正常透過代理轉發。

## 快速開始

### 1. 設定全域指令（只需做一次）

```bash
cd /Users/huangweizhe/dev-prompt
npm link
```

（若不想全域安裝，也可以直接執行 `node /Users/huangweizhe/dev-prompt/bin/dev-prompt.mjs`。）

### 2. 啟動代理

在你的專案資料夾（例如 `~/HearWell`）裡啟動原本的開發伺服器後，另開一個終端視窗執行：

```bash
# 聽伴（Django runserver 預設在 8000）
dev-prompt http://127.0.0.1:8000

# 或指定專案資料夾，把標註存在該專案的 .dev-prompts.json
dev-prompt http://127.0.0.1:8000 --project ~/HearWell

# 其他框架也一樣（Vite 5173、Next.js 3000、甚至線上網址）
dev-prompt http://localhost:5173
dev-prompt https://tingpal.tw --project ~/HearWell
```

啟動後終端會印出兩個網址：
- **電腦打開**：`http://127.0.0.1:8787`
- **手機打開**：`http://<你的電腦區網IP>:8787`（手機跟電腦連同一個 Wi-Fi）

### 3. 在電腦或手機上點選標註

1. 點右下角 **「點選標註」**。
2. 頁面一樣可以正常上下滑動；滑到想改的位置後，用滑鼠或手指點一下該元件。
3. 如果手指點太細（例如點到按鈕裡的圖示），可按 **「改選上一層 ↑」** 放大選取範圍。
4. 輸入想怎麼改（手機可直接用語音輸入），按 **「送出標註」**。
5. 可以一次逛完多個頁面、連續送出多筆標註。

### 4. 請 AI 代理直接修改

回到你的 AI 對話（Antigravity / Claude Code / Codex），說一句：

> 「幫我讀 `.dev-prompts.json` 處理裡面的標註」

AI 改完並把狀態標記為 `done` 後，在手機上重新整理頁面就能看到結果，點開右下角 **「清單」** 也會顯示綠色的「已處理」。

## 常用子指令

```bash
dev-prompt list                # 查看目前待處理的標註（Markdown 格式）
dev-prompt done <id>           # 將單筆標註標記為完成
dev-prompt done all            # 將所有待處理標註標記為完成
dev-prompt clear               # 清空標註清單
```

> 建議把 `.dev-prompts.json` 加進各專案的 `.gitignore`（或全域 gitignore），避免暫時的修改筆記進版控。

## 執行測試

```bash
npm test
```
