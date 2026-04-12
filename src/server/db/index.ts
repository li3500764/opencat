// ============================================================
// Prisma Client 单例（Prisma 7 版本）
// ============================================================
// Prisma 7 的破坏性变更：
// 1. 不再支持 datasourceUrl 构造参数（URL 在 prisma.config.ts 里）
// 2. 默认使用 "client" 引擎，需要传入 driver adapter
// 3. adapter 负责实际的数据库连接，Prisma 只负责查询构建
//
// 为什么需要单例？
// Next.js 开发模式每次热更新都会重执行模块，
// 不用单例的话数据库连接池会无限增长直到爆掉。

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// 声明全局类型，避免热更新时重复创建
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// pg.Pool 管理数据库连接池：最多 10 个连接，空闲 30 秒后释放
const pool =
  globalForPrisma.pool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
  });

// PrismaPg adapter：把 pg Pool 包装成 Prisma 7 需要的接口
const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Prisma 7 client engine 不支持 log 选项，如果需要调试用 Prisma 的 debug 模式
    // 设置环境变量 DEBUG="prisma:client" 即可
  });

// 开发环境缓存到全局
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pool = pool;
}
