# ============================================================
# OpenCat — 多阶段 Docker 构建
# ============================================================

# ---- 阶段 1: 基础镜像 ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---- 阶段 2: 安装依赖 ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null || true

# ---- 阶段 3: 构建应用 ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置 standalone 输出模式
ENV STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1

# 直接用 next build 跳过 pnpm 的 deps 状态检查
RUN ./node_modules/.bin/next build

# ---- 阶段 4: 生产运行 ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安全：非 root 用户
RUN addgroup --system --gid 1001 opencat && \
    adduser --system --uid 1001 opencat

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=opencat:opencat /app/.next/standalone ./
COPY --from=builder --chown=opencat:opencat /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER opencat

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/session || exit 1

CMD ["node", "server.js"]
