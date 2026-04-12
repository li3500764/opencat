// ============================================================
// Prisma 7 配置文件
// ============================================================
// Prisma 7 把数据库连接 URL 从 schema.prisma 移到了这个独立配置文件
// 好处：schema 文件可以安全公开到 GitHub，连接信息在这里单独管理
// prisma migrate / prisma db push 等命令都会读这个文件

import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// 手动加载 .env，确保 DATABASE_URL 能读到
dotenv.config();

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  // datasource.url 就是以前 schema.prisma 里的 url = env("DATABASE_URL")
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
