// ============================================================
// NextAuth API 路由
// ============================================================
// 这个文件是 NextAuth 的入口点。
// [...nextauth] 是 Next.js 的 catch-all 路由，
// 会匹配 /api/auth/signin, /api/auth/callback/github 等所有路径。
//
// handlers 里包含了 GET 和 POST 两个处理器：
// GET  → 处理 OAuth 回调、获取 session 等
// POST → 处理登录表单提交、登出等

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
