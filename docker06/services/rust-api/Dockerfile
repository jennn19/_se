# ---------- Stage 1: 建置 ----------
FROM rust:1.85-slim AS builder
WORKDIR /app

# 先複製 Cargo.toml 以利用 Docker layer cache
COPY Cargo.toml ./
COPY src ./src

RUN cargo build --release

# ---------- Stage 2: 執行環境 ----------
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 10001 appuser

COPY --from=builder /app/target/release/rust-api /usr/local/bin/rust-api

USER appuser
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -f http://127.0.0.1:3001/health || exit 1

CMD ["rust-api"]
