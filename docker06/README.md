# Docker 微服務系統展示

一個以 **Docker** 與 **Docker Compose** 建置的微服務系統，整合多種語言與技術：

| 服務 | 技術 | 角色 |
|------|------|------|
| **nginx** | Nginx 1.27 | Web Server + 反向代理（Reverse Proxy），對外統一入口 |
| **db** | PostgreSQL 16 | 關聯式資料庫，儲存訊息與計數 |
| **node-api** | Node.js 20 + Express | 訊息管理微服務（讀寫資料庫） |
| **rust-api** | Rust + Axum | 高效能運算微服務（質數 / 費氏數列） |
| **python-api** | Python 3.12 + Flask | 資料統計微服務（彙總資料庫內容） |

最後提供一個**簡易 Web 介面（儀表板）**，即時展示整個 Docker 系統的運作狀況。

---

## 目錄

- [系統架構](#系統架構)
- [專案結構](#專案結構)
- [快速開始](#快速開始)
- [服務說明與 API](#服務說明與-api)
- [Docker 學習筆記](#docker-學習筆記)
- [常用指令](#常用指令)
- [疑難排解](#疑難排解)

---

## 系統架構

```
                         ┌─────────────────────────────────────┐
        瀏覽器  ───────►  │            Nginx (:8080)            │
       http://localhost:8080 │  Web Server + Reverse Proxy       │
                         └───────────────┬─────────────────────┘
                                         │  (frontend network)
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
          ┌────────────┐         ┌────────────┐         ┌────────────┐
          │  node-api  │         │  rust-api  │         │ python-api │
          │  Node.js   │         │    Rust    │         │   Python   │
          │   :3000    │         │   :3001    │         │   :5000    │
          └─────┬──────┘         └────────────┘         └─────┬──────┘
                │                  (frontend)                 │
                └───────────────────┬─────────────────────────┘
                                    │  (backend, 不對外)
                                    ▼
                            ┌───────────────┐
                            │  PostgreSQL   │
                            │     :5432     │
                            └───────────────┘
```

**設計重點：**

- **Nginx** 是唯一對外開放的入口（host port `8080`），其餘服務皆不直接暴露到主機。
- `node-api` 與 `python-api` 需要資料庫，因此同時連接 `backend` 與 `frontend` 兩個網路。
- `db` 只存在於 `backend` 網路，外部無法直接連線，兼顧安全。
- Nginx 透過 Docker 內建 DNS 以**服務名稱**（`node-api`、`rust-api`、`python-api`）轉發請求。
- 所有服務皆設定 `healthcheck`，`docker compose ps` 可直接看到健康狀態。

---

## 專案結構

```
docker06/
├── docker-compose.yml          # 整個系統的編排（Orchestration）
├── README.md
├── .gitignore
├── db/
│   └── init.sql                # 資料庫初始化腳本（首次啟動自動執行）
├── nginx/
│   ├── Dockerfile              # 自訂 Nginx 映像
│   ├── nginx.conf              # 反向代理設定
│   └── html/
│       └── index.html          # 簡易 Web 儀表板
└── services/
    ├── node-api/
    │   ├── Dockerfile
    │   ├── package.json
    │   └── server.js
    ├── rust-api/
    │   ├── Dockerfile
    │   ├── Cargo.toml
    │   └── src/main.rs
    └── python-api/
        ├── Dockerfile
        ├── requirements.txt
        └── app.py
```

---

## 快速開始

### 需求

- 已安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（含 Docker Compose）
- 確認可用：

```bash
docker --version
docker compose version
```

### 啟動

在專案根目錄執行：

```bash
# 建置映像並在背景啟動所有服務
docker compose up -d --build
```

### 開啟網頁

瀏覽器打開：

```
http://localhost:8080
```

即可看到微服務儀表板，能：

- 檢視各服務即時健康狀態（綠燈／紅燈）
- 新增／瀏覽訊息（由 Node.js 寫入 PostgreSQL）
- 檢視統計資料（由 Python 從 PostgreSQL 彙總）
- 呼叫 Rust 運算微服務（質數判斷、費氏數列）

### 關閉

```bash
# 停止並移除容器（保留資料庫資料）
docker compose down

# 停止並同時刪除資料庫資料（volume）
docker compose down -v

# 只看日誌
docker compose logs -f
```

---

## 服務說明與 API

所有請求都經由 Nginx 反向代理，路徑前綴對應各服務。

### Nginx（入口）

| 路徑 | 說明 |
|------|------|
| `GET /` | Web 儀表板 |
| `GET /nginx-health` | Nginx 健康檢查 |
| `/node/*` | 轉發至 `node-api:3000`（移除 `/node` 前綴） |
| `/rust/*` | 轉發至 `rust-api:3001`（移除 `/rust` 前綴） |
| `/python/*` | 轉發至 `python-api:5000`（移除 `/python` 前綴） |

### Node.js 微服務（訊息管理）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/node/health` | 健康檢查 |
| `GET` | `/node/api/info` | 服務資訊 |
| `GET` | `/node/api/messages` | 取得最新 50 筆訊息 |
| `POST` | `/node/api/messages` | 新增訊息，body：`{"author":"...","content":"..."}` |

### Rust 微服務（高效能運算）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/rust/health` | 健康檢查 |
| `GET` | `/rust/api/info` | 服務資訊 |
| `GET` | `/rust/api/prime/{n}` | 判斷 `n` 是否為質數 |
| `GET` | `/rust/api/fibonacci/{n}` | 計算第 `n` 個費氏數列值（n ≤ 186），並回報耗時 |

### Python 微服務（資料統計）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/python/health` | 健康檢查 |
| `GET` | `/python/api/info` | 服務資訊 |
| `GET` | `/python/api/stats` | 彙總：訊息總數、訪客數、平均字數、各作者訊息數 |
| `POST` | `/python/api/visit` | 訪客計數 +1 |

### 測試範例

```bash
# 服務資訊
curl http://localhost:8080/node/api/info
curl http://localhost:8080/rust/api/info
curl http://localhost:8080/python/api/info

# 新增訊息
curl -X POST http://localhost:8080/node/api/messages \
     -H "Content-Type: application/json" \
     -d '{"author":"Alice","content":"Hello Docker!"}'

# 讀取訊息與統計
curl http://localhost:8080/node/api/messages
curl http://localhost:8080/python/api/stats

# Rust 運算
curl http://localhost:8080/rust/api/prime/97
curl http://localhost:8080/rust/api/fibonacci/30
```

---

## Docker 學習筆記

以下整理本專案實際使用到的 Docker 核心觀念。

### 1. 映像（Image）與容器（Container）

- **映像**是唯讀的執行範本；**容器**是映像的執行實例。
- 本專案每個服務都有自己的 `Dockerfile`，用 `docker compose build` 產生映像。
- 查看：

```bash
docker images                    # 列出映像
docker ps                        # 列出執行中的容器
docker ps -a                     # 包含已停止的容器
```

### 2. Dockerfile

每個服務的 `Dockerfile` 都採用**多階段建置（Multi-stage Build）**：

```dockerfile
# 第一階段：安裝依賴 / 建置
FROM node:20-alpine AS deps
...
# 第二階段：只複製需要的產物到精簡的執行映像
FROM node:20-alpine
COPY --from=deps /app/node_modules ./node_modules
```

**優點：** 建置工具（如編譯器、套件快取）不會進入最終映像，映像更小、更安全。

Rust 服務更明顯：使用 `rust:1.85-slim` 編譯出執行檔，再複製到乾淨的 `debian:bookworm-slim`，最終映像不含整個 Rust 工具鏈。

其他重點：

- **`EXPOSE`**：標示容器監聽的埠（僅為文件用途）。
- **`USER appuser`**：以非 root 使用者執行，符合最小權限原則。
- **`HEALTHCHECK`**：定義容器健康檢查指令，Compose 可據此判斷服務是否就緒。
- **`.dockerignore`**：排除 `node_modules`、`target`、`__pycache__` 等，加快建置並避免汙染映像。

### 3. Docker Compose

`docker-compose.yml` 用宣告式的方式編排多個服務：

```yaml
services:
  db:
    image: postgres:16-alpine        # 直接使用官方映像
    healthcheck: ...                 # 健康檢查
    volumes:
      - db-data:/var/lib/postgresql/data   # 具名 volume 持久化資料
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # 掛載初始化腳本
    networks: [backend]
  node-api:
    build: ./services/node-api       # 從 Dockerfile 建置
    depends_on:
      db:
        condition: service_healthy   # 等資料庫健康後才啟動
    networks: [backend, frontend]
```

**核心概念：**

| 概念 | 用途 |
|------|------|
| `services` | 定義每個容器 |
| `build` / `image` | 自行建置或用現成映像 |
| `ports` | 主機埠對應容器埠（`8080:80`） |
| `environment` | 注入環境變數（如資料庫連線資訊） |
| `volumes` | 資料持久化 / 掛載設定檔 |
| `networks` | 服務間的通訊隔離 |
| `depends_on` + `condition` | 控制啟動順序 |
| `restart: unless-stopped` | 容器異常時自動重啟 |

### 4. 網路（Networks）

- 建立 `frontend` 與 `backend` 兩個自訂 bridge 網路。
- 同一個網路內的容器可用**服務名稱**互相解析（Docker 內建 DNS）。
- `db` 只接 `backend`，外部與 `rust-api` 都連不到，達到網路隔離。
- Nginx 的 `nginx.conf` 使用 `resolver 127.0.0.11` 動態解析後端容器，即使容器重啟換 IP 也能運作。

### 5. 資料持久化（Volumes）

- 使用具名 volume `db-data` 保存 PostgreSQL 資料。
- 即使 `docker compose down` 刪除容器，資料仍在；`down -v` 才會一併清除。
- `db/init.sql` 掛載到 `/docker-entrypoint-initdb.d/`，只在資料庫**第一次初始化**時執行。

### 6. 啟動順序與健康檢查

- `python-api` 啟動時會重試連線資料庫；`node-api` 也有等待資料庫的重試邏輯。
- Compose 的 `depends_on.condition: service_healthy` 確保 `db` 通過 `pg_isready` 後，後端服務才啟動。
- 每個服務的 `HEALTHCHECK` 讓 `docker compose ps` 顯示 `(healthy)` 狀態。

---

## 常用指令

```bash
# 建置
docker compose build                 # 建置所有服務映像
docker compose build rust-api        # 只建置某個服務

# 啟動 / 停止
docker compose up -d                 # 背景啟動
docker compose up -d --build         # 重新建置並啟動
docker compose stop                  # 停止（保留容器）
docker compose down                  # 停止並移除容器 / 網路
docker compose down -v               # 連同 volume 一併刪除

# 觀察
docker compose ps                    # 服務狀態
docker compose logs -f               # 串流所有日誌
docker compose logs -f node-api      # 只看某服務日誌
docker compose top                   # 各容器內的行程

# 進入容器
docker compose exec node-api sh
docker compose exec db psql -U appuser -d appdb

# 直接連進資料庫查詢
docker compose exec db psql -U appuser -d appdb -c "SELECT * FROM messages;"

# 重新建置單一服務並重啟
docker compose up -d --build python-api
```

---

## 疑難排解

| 問題 | 解法 |
|------|------|
| 連接埠 8080 被占用 | 修改 `docker-compose.yml` 中 nginx 的 `ports`，例如 `"8090:80"` |
| 資料表沒有資料 | `init.sql` 只在 volume 首次建立時執行；執行 `docker compose down -v` 後重新 `up` |
| Rust 建置失敗（edition2024） | 需使用較新的 Rust 映像（本專案使用 `rust:1.85-slim`） |
| 服務顯示 unhealthy | 用 `docker compose logs <service>` 檢查；後端服務需等資料庫就緒 |
| 網頁資料顯示不出來 | 確認五個容器都在 `docker compose ps` 中為 `Up (healthy)` |
| 想完全重置 | `docker compose down -v --rmi local` 移除容器、volume 與自建映像 |

---

## 授權

本專案為 Docker 教學示範用途，可自由修改使用。
