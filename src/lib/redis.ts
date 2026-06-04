import Redis from "ioredis";

// 创建全局类型声明，在开发环境中缓存 Redis 实例，防止 Next.js 热重载 (Hot Reload) 导致连接数暴涨
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// 从环境变量读取 REDIS_URL，如果未配则默认连接本地
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// 创建或复用 Redis 客户端实例
export const redis = globalForRedis.redis ?? new Redis(redisUrl, {
  // 设置最大重连尝试次数，避免 Redis 挂掉导致 Next.js 无限挂起
  maxRetriesPerRequest: null,
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
