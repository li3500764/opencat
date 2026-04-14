import type { NextConfig } from "next";

// ============================================================
// Next.js 配置
// ============================================================
// - 默认模式：标准 Next.js server（pnpm dev / pnpm build + pnpm start）
// - TAURI=1：静态导出模式，Tauri 桌面端需要（output: 'export'）
// - 生产部署：standalone 模式，Docker 容器需要（output: 'standalone'）

const isTauri = process.env.TAURI === "1";

const nextConfig: NextConfig = {
  // Tauri 需要静态导出，Docker 生产需要 standalone
  ...(isTauri
    ? { output: "export" as const }
    : process.env.STANDALONE === "1"
      ? { output: "standalone" as const }
      : {}),

  // 服务端外部化（避免打包 pg 等原生模块）
  serverExternalPackages: ["pg", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
