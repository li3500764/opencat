// ============================================================
// 用户注册 API
// ============================================================
// POST /api/auth/register
// Body: { email, password, name? }
//
// NextAuth 的 Credentials provider 只处理登录，不处理注册。
// 注册需要我们自己写：验证输入 → hash 密码 → 插入数据库

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

// Zod schema：运行时类型校验，比手动 if/else 检查干净 100 倍
const registerSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 校验请求体
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = result.data;

    // 检查邮箱是否已注册
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 } // 409 Conflict
      );
    }

    // bcrypt hash 密码
    // saltRounds=12：越高越安全但越慢，12 是 2024 年的推荐值
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? email.split("@")[0], // 没填名字就用邮箱前缀
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Registration successful", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
