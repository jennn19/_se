const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.PGHOST || "db",
  port: parseInt(process.env.PGPORT || "5432", 10),
  user: process.env.PGUSER || "appuser",
  password: process.env.PGPASSWORD || "apppassword",
  database: process.env.PGDATABASE || "appdb",
});

// 等待資料庫就緒並自動重試
async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[node-api] PostgreSQL 連線成功");
      return true;
    } catch (err) {
      console.log(`[node-api] 等待 PostgreSQL... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("無法連線到 PostgreSQL");
}

// 健康檢查
app.get("/health", (req, res) => {
  res.json({ service: "node-api", status: "ok", language: "Node.js" });
});

// 服務資訊
app.get("/api/info", (req, res) => {
  res.json({
    service: "node-api",
    language: "Node.js",
    runtime: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    description: "負責訊息的建立與讀取（PostgreSQL 後端）",
  });
});

// 取得所有訊息
app.get("/api/messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, author, content, created_at FROM messages ORDER BY id DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 新增訊息
app.post("/api/messages", async (req, res) => {
  const { author, content } = req.body || {};
  if (!author || !content) {
    return res.status(400).json({ error: "author 與 content 為必填" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO messages (author, content) VALUES ($1, $2) RETURNING id, author, content, created_at",
      [String(author).slice(0, 80), String(content).slice(0, 1000)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

waitForDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[node-api] 監聽 http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
