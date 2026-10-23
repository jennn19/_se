# 微光筆記（Note App）

一個以 Node.js Express 為後端、原生 HTML/JavaScript 為前端的極簡線上筆記應用。介面使用 Tailwind CSS CDN，資料儲存在伺服器記憶體中，並完整涵蓋 Vitest 單元測試、Supertest Web API 測試與 Playwright E2E 測試。

## 功能特色

- 淡雅漸層背景搭配白色卡片、圓角與陰影的現代化介面。
- 輸入框具備 focus 邊框、光暈效果與即時字數顯示。
- 支援新增筆記、自動載入筆記、空白狀態提示與錯誤訊息。
- 後端會先去除內容前後空白，再驗證長度必須介於 1 到 50 個字元。
- 筆記保存在 Express 應用實例的記憶體陣列中。

## 技術棧

| 層級 | 技術 |
| --- | --- |
| 後端 | Node.js、Express |
| 前端 | HTML、Vanilla JavaScript、Tailwind CSS CDN |
| 單元測試 | Vitest |
| 系統測試 | Vitest + Supertest |
| E2E 測試 | Playwright、TypeScript |

## 專案結構

```text
test07/
├── server.js                 # Express 伺服器、API 與驗證邏輯
├── static/
│   ├── index.html            # Tailwind CSS 頁面
│   └── app.js                # Fetch API 與 DOM 操作
├── tests/
│   ├── validation.test.js    # Vitest 驗證邏輯單元測試
│   └── api.test.js           # Vitest + Supertest Web API 測試
├── e2e/
│   └── note.spec.ts          # Playwright E2E 測試
├── vitest.config.js          # 限制 Vitest 只執行 tests/ 下的測試
├── playwright.config.ts
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## 環境需求

- Node.js 20 以上
- npm
- 首次載入 Tailwind CSS CDN 時需要網路連線

## 安裝與啟動

請在 `test07` 目錄執行：

```bash
cd test07
npm install
npx playwright install chromium
npm start
```

啟動後開啟：

```text
http://127.0.0.1:3000
```

開發模式會在檔案變更時自動重新啟動：

```bash
npm run dev
```

若需要變更連接埠：

```powershell
$env:PORT = "3001"
npm start
```

使用自訂連接埠時，請同步修改 `playwright.config.ts` 的 `baseURL` 與 `webServer.url`。

## API 規格

### `GET /api/notes`

取得所有筆記，回傳字串陣列。

```json
["買牛奶與雞蛋", "閱讀一章書"]
```

狀態碼：`200 OK`

### `POST /api/notes`

新增一則筆記。

請求內容：

```json
{
  "content": "  買牛奶與雞蛋  "
}
```

成功時會去除前後空白並回傳：

```json
{
  "content": "買牛奶與雞蛋"
}
```

狀態碼：`201 Created`

驗證失敗時回傳：

```json
{
  "error": "筆記內容不能為空。"
}
```

狀態碼：`400 Bad Request`

商務規則：

- 去除前後空白後，長度必須至少 1 個字元。
- 去除前後空白後，長度不得超過 50 個字元。
- 長度以 Unicode 字元數計算，中文每個字算 1 個字元。

## 測試指令

### 1. Vitest 單元測試

```bash
npm run test:unit
```

測試 `validateNote`：

- 合法內容會去除前後空白。
- 空字串驗證失敗。
- 純空白內容驗證失敗。
- 超過 50 字驗證失敗。
- 剛好 50 字驗證成功。

### 2. Supertest Web API 測試

```bash
npm run test:api
```

測試 `POST /api/notes`：

- 帶入正確 JSON 時回傳 `201 Created`。
- 新增後的筆記可透過 `GET /api/notes` 取得。
- 超過 50 字時回傳 `400 Bad Request`。

執行全部 Vitest 測試：

```bash
npm test
```

### 3. Playwright E2E 測試

```bash
npm run test:e2e
```

Playwright 會依照 `playwright.config.ts` 自動執行 `node server.js`、等待伺服器就緒，再啟動 Chromium 執行測試。

其他模式：

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

E2E 測試會模擬：

1. 開啟首頁。
2. 在 `data-testid="note-input"` 輸入筆記。
3. 點擊「新增筆記」。
4. 驗證列表中出現該筆記，且具備圓角與陰影樣式。
5. 驗證輸入框已清空、空白狀態提示已隱藏。

執行全部測試：

```bash
npm run test:all
```

## 測試用 `data-testid`

| 元素 | `data-testid` |
| --- | --- |
| 筆記輸入框 | `note-input` |
| 新增按鈕 | `note-submit` |
| 筆記列表項目 | `note-item` |
| 空白狀態 | `empty-state` |
| 錯誤訊息 | `note-error` |
| 筆記列表容器 | `note-list` |

## 實作說明

- `server.js` 匯出 `validateNote`、`createApp` 與預設的 `app`。
- 只有直接執行 `node server.js` 時才會呼叫 `app.listen`，因此 Supertest 可以直接匯入 `createApp` 測試，不會佔用固定連接埠。
- 每個 `createApp()` 都有獨立的記憶體筆記陣列，避免測試之間互相污染。
- 靜態檔案路徑以 `server.js` 所在位置為基準，因此從其他工作目錄啟動也能正確載入前端。
- 前端以 `textContent` 建立筆記內容，避免將使用者輸入直接插入 HTML。
- 筆記只保存在記憶體中，重新啟動伺服器後會清空。
- Tailwind CSS 使用 CDN 版本，適合展示與測試；正式部署建議改為建置後的 CSS 檔案。
