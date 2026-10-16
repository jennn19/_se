import os
import time
import socket

import psycopg2
import psycopg2.extras
from flask import Flask, jsonify

app = Flask(__name__)

START_TIME = time.time()

DB_CONFIG = {
    "host": os.environ.get("PGHOST", "db"),
    "port": int(os.environ.get("PGPORT", "5432")),
    "user": os.environ.get("PGUSER", "appuser"),
    "password": os.environ.get("PGPASSWORD", "apppassword"),
    "dbname": os.environ.get("PGDATABASE", "appdb"),
}


def get_connection(retries=30, delay=2):
    """等待 PostgreSQL 就緒並取得連線。"""
    last_err = None
    for _ in range(retries):
        try:
            return psycopg2.connect(**DB_CONFIG)
        except psycopg2.OperationalError as err:
            last_err = err
            time.sleep(delay)
    raise last_err


@app.get("/health")
def health():
    return jsonify(service="python-api", status="ok", language="Python")


@app.get("/api/info")
def info():
    return jsonify(
        service="python-api",
        language="Python",
        version=os.sys.version.split()[0],
        hostname=socket.gethostname(),
        uptime_seconds=int(time.time() - START_TIME),
        description="資料統計微服務（讀取 PostgreSQL 並彙總）",
    )


@app.get("/api/stats")
def stats():
    """從 PostgreSQL 讀取訊息並產生統計資料。"""
    try:
        conn = get_connection(retries=3)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS total FROM messages")
            total = cur.fetchone()["total"]

            cur.execute(
                "SELECT author, COUNT(*) AS count FROM messages "
                "GROUP BY author ORDER BY count DESC LIMIT 10"
            )
            by_author = cur.fetchall()

            cur.execute("SELECT value FROM counters WHERE name = 'visits'")
            row = cur.fetchone()
            visits = row["value"] if row else 0

        conn.close()

        # 計算平均字數（Python 端處理）
        conn = get_connection(retries=3)
        with conn.cursor() as cur:
            cur.execute("SELECT content FROM messages")
            contents = [r[0] for r in cur.fetchall()]
        conn.close()

        avg_len = round(sum(len(c) for c in contents) / len(contents), 1) if contents else 0

        return jsonify(
            total_messages=total,
            visits=visits,
            average_content_length=avg_len,
            messages_by_author=[dict(r) for r in by_author],
        )
    except Exception as err:  # noqa: BLE001
        return jsonify(error=str(err)), 500


@app.post("/api/visit")
def visit():
    """訪客計數 +1。"""
    try:
        conn = get_connection(retries=3)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE counters SET value = value + 1, updated_at = NOW() "
                "WHERE name = 'visits' RETURNING value"
            )
            value = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify(visits=value)
    except Exception as err:  # noqa: BLE001
        return jsonify(error=str(err)), 500


if __name__ == "__main__":
    # 確認資料庫可用（啟動時嘗試連線）
    get_connection()
    app.run(host="0.0.0.0", port=5000)
