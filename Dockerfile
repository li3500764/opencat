# ============================================================
# OpenCat — 多阶段 Docker 构建
# ============================================================
# 阶段 1 (base)    → 基础镜像 + pnpm
# 阶段 2 (deps)    → 安装依赖
# 阶段 3 (builder) → 构建 Next.js standalone
# 阶段 4 (runner)  → 生产运行镜像（~200MB）
#
# 构建命令：docker build -t opencat .
# 运行命令：docker run -p 3000:3000 --env-file .env.production opencat

# ---- 阶段 1: 基础镜像 ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---- 阶段 2: 安装依赖 ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

# ---- 阶段 3: 构建应用 ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置 standalone 输出模式
ENV STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1

# 生成 Prisma Client + 构建 Next.js
RUN pnpm prisma generate && pnpm build

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

# 复制 Prisma 相关文件（运行时需要）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER opencat

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/session || exit 1

CMD ["node", "server.js"]
