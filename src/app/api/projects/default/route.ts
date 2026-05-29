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

  // 查找已有的项目 (这里不硬编码 Name="Default", 而是直接找用户的第一个项目)
  let project = await db.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });

  // 如果没有，自动创建
  if (!project) {
    project = await db.project.create({
      data: {
        userId,
        name: "Default",
        description: "Default project",
        defaultModel: "gpt-5.4-mini",
      },
    });
  }

  return Response.json(project);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const { defaultModel, defaultEmbeddingModel } = body;

  let project = await db.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (defaultModel) updateData.defaultModel = defaultModel;
  if (defaultEmbeddingModel) updateData.defaultEmbeddingModel = defaultEmbeddingModel;

  if (Object.keys(updateData).length > 0) {
    project = await db.project.update({
      where: { id: project.id },
      data: updateData
    });
  }

  return Response.json(project);
}
