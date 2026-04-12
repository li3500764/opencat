// ============================================================
// NextAuth v5 配置
// ============================================================
// NextAuth (现在叫 Auth.js) 是 Next.js 生态最主流的认证方案
// 它帮你处理：OAuth 登录流程、Session 管理、CSRF 防护、JWT 签发
//
// 我们配了两种登录方式：
// 1. GitHub OAuth — 用户点"用 GitHub 登录"，跳转授权后回调
// 2. Credentials — 传统邮箱 + 密码登录（注册功能需要单独写 API）

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // PrismaAdapter 让 NextAuth 把用户数据存到我们的 PostgreSQL
  // 而不是默认的 JWT-only 模式（那样没法查用户列表）
  adapter: PrismaAdapter(db),

  // Session 策略用 JWT：token 存在 cookie 里，服务端无状态
  // 对比 database session：每次请求都要查 DB，性能差
  session: { strategy: "jwt" },

  // 登录页面路由（我们自己写 UI，不用 NextAuth 默认的丑页面）
  pages: {
    signIn: "/login",
  },

  providers: [
    // --- GitHub OAuth ---
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),

    // --- 邮箱密码登录 ---
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // 查数据库找用户
        const user = await db.user.findUnique({
          where: { email },
        });

        // 用户不存在 or 没设密码（OAuth 用户）→ 拒绝
        if (!user || !user.password) {
          return null;
        }

        // bcrypt 比对密码
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        // 返回用户对象，NextAuth 会把它序列化到 JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    // JWT callback：每次生成/更新 token 时调用
    // 把 user.id 塞到 token 里，后续能从 session 拿到
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // Session callback：每次读取 session 时调用
    // 把 token 里的 id 暴露到 session.user.id
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
