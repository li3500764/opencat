// ============================================================
// NextAuth 类型扩展
// ============================================================
// NextAuth 默认的 Session 类型里 user 没有 id 字段，
// 但我们在 jwt callback 里加了 id，TypeScript 不知道。
// 这里通过模块声明合并（module augmentation）把 id 加上去。

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
