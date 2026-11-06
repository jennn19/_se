# 一週冰箱剩食食譜大師

輸入冰箱裡剩下的食材，Cloudflare Workers AI 會扮演五星級大廚，規劃 1–2 道 20 分鐘內能完成的晚餐，優先幫你消耗剩食。

## 功能

- 食材標籤輸入：按 Enter、逗號或頓號即可加入；支援 Backspace 快速移除。
- 常用食材快選，自動避免重複加入。
- 用餐人數 1–8 人，份量交給大廚換算。
- 可填寫飲食限制或偏好（素食、不吃辣、清淡…）。
- AI 回傳結構化食譜：料理名稱、時間、份量、難度、食材、常備調味、步驟、主廚小撇步。
- 可複製單道或全部食譜。
- 食材與偏好會存在瀏覽器 localStorage，下次打開自動帶入。
- 手機、桌機自適應，支援深色模式。

## 專案結構

```
09/
├─ public/            # 靜態前端（由 Cloudflare Static Assets 提供）
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ favicon.svg
├─ src/
│  └─ index.js        # Worker：/api/recipes、/api/health
├─ wrangler.jsonc     # Worker + Static Assets + Workers AI 設定
├─ package.json
└─ README.md
```

## 本機開發

需要 Node.js 18 以上（本專案以 Node 24 測試）。

```powershell
npm install
npx wrangler login
npm run dev
```

開啟終端機顯示的網址（通常是 http://localhost:8787）。

Workers AI 需要登入 Cloudflare 才能使用；未登入時 `/api/recipes` 會回傳清楚的錯誤訊息。

## 部署到 Cloudflare

```powershell
# 第一次使用先登入（會開啟瀏覽器授權）
npx wrangler login

# 部署 Worker + 靜態網站
npm run deploy
```

部署成功後終端機會顯示網址，例如：

```
https://fridge-recipe-master.<你的-subdomain>.workers.dev
```

### 部署前檢查

```powershell
# 只打包、不真的部署，用來確認設定與程式碼沒問題
npm run check
```

### 如果名稱撞名

`wrangler.jsonc` 的 `name` 是 Worker 名稱。若帳號內已有同名 Worker，改成其他名稱再部署即可。

```jsonc
{
  "name": "fridge-recipe-master",
  ...
}
```

## 使用到的 Cloudflare 服務

| 服務 | 用途 |
| --- | --- |
| Workers | 執行 `/api/recipes` 後端邏輯 |
| Workers AI | 使用 `@cf/zai-org/glm-4.7-flash` 生成食譜 |
| Static Assets | 直接託管 `public/` 內的前端檔案 |

Workers AI 有免費額度（每日 Neuron 用量），個人練習與展示通常足夠；實際額度依 Cloudflare 方案為準。

## API

### `POST /api/recipes`

```json
{
  "ingredients": ["高麗菜", "紅蘿蔔", "雞蛋"],
  "servings": 2,
  "notes": "不吃辣"
}
```

回應：

```json
{
  "ok": true,
  "model": "@cf/zai-org/glm-4.7-flash",
  "data": {
    "chefNote": "高麗菜梗也能切細一起炒，口感更甜。",
    "recipes": [
      {
        "name": "高麗菜紅蘿蔔烘蛋",
        "description": "把冰箱剩菜通通藏進蛋裡。",
        "cookTime": "15 分鐘",
        "servings": "2 人份",
        "difficulty": "簡單",
        "ingredients": ["高麗菜 1/4 顆", "紅蘿蔔 1/3 根", "雞蛋 3 顆"],
        "pantry": ["鹽", "醬油", "食用油"],
        "steps": ["高麗菜切絲、紅蘿蔔刨絲。", "熱鍋少油拌炒蔬菜。", "倒入蛋液，小火烘至兩面金黃。"],
        "tip": "加一點起司會更香。"
      }
    ]
  },
  "raw": "..."
}
```

若模型沒有回傳合法 JSON，`data` 會是 `null`，前端會改為顯示 `raw` 原始內容。

### `GET /api/health`

檢查 Worker 與 AI binding 是否正常：

```json
{ "ok": true, "model": "@cf/zai-org/glm-4.7-flash", "aiBound": true }
```

## 注意事項

- AI 生成的料理步驟僅供參考，請自行確認食材新鮮度、過敏原與加熱熟度。
- 食材清單與偏好只會送到你自己的 Worker，不會存到伺服器；前端僅用 localStorage 保存在本機。
- 每次生成約需 5–15 秒，取決於佇列與模型負載。
