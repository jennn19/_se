# ---------- Stage 1: 安裝依賴 ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ---------- Stage 2: 執行環境 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 建立非 root 使用者（安全性最佳實務）
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
