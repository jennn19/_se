-- 初始化資料庫 schema
-- 這個檔案會在 PostgreSQL container 第一次啟動時自動執行

CREATE TABLE IF NOT EXISTS messages (
    id         SERIAL PRIMARY KEY,
    author     VARCHAR(80)  NOT NULL,
    content    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 系統啟動次數 / 訪客計數
CREATE TABLE IF NOT EXISTS counters (
    name       VARCHAR(50) PRIMARY KEY,
    value      BIGINT      NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO counters (name, value)
VALUES ('visits', 0)
ON CONFLICT (name) DO NOTHING;

-- 一些示範資料
INSERT INTO messages (author, content)
VALUES
    ('system', '歡迎來到 Docker 微服務展示系統！'),
    ('system', '這個訊息來自 PostgreSQL 資料庫。')
ON CONFLICT DO NOTHING;
