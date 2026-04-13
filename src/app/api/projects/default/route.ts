// ============================================================
// Default Project API（Day 5）
// ============================================================
//
// GET /api/projects/default
// 获取（或自动创建）用户的默认项目
//
// 为什么需要 Default Project？
// ---
// Agent 必须属于一个 Project。
// 对于大多数用户（特别是刚注册的），我们自动创建一个 Default 项目。
// 这样用户不需要手动建项目就能开始使用 Agent。
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 查找已有的 Default 项目
  let project = await db.project.findFirst({
    where: { userId, name: "Default" },
  });

  // 如果没有，自动创建
  if (!project) {
    project = await db.project.create({
      data: {
        userId,
        name: "Default",
        description: "Default project",
        defaultModel: "gpt-4o",
      },
    });
  }

  return Response.json(project);
}
