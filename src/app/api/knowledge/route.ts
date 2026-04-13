// ============================================================
// KnowledgeBase API — 知识库 CRUD（Day 6）
// ============================================================
//
// GET  /api/knowledge        → 获取用户的知识库列表
// POST /api/knowledge        → 创建新知识库
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

// GET — 知识库列表
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const knowledgeBases = await db.knowledgeBase.findMany({
    where: {
      project: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      projectId: true,
      createdAt: true,
      // 附带文档数量和 chunk 总数
      _count: { select: { documents: true } },
      documents: {
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          chunkCount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return Response.json(knowledgeBases);
}

// POST — 创建知识库
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, projectId } = await req.json();
  if (!name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // 确保项目属于用户
  let pid = projectId;
  if (!pid) {
    // 自动使用 Default 项目
    let project = await db.project.findFirst({
      where: { userId: session.user.id, name: "Default" },
    });
    if (!project) {
      project = await db.project.create({
        data: { userId: session.user.id, name: "Default", description: "Default project", defaultModel: "gpt-5.4-mini" },
      });
    }
    pid = project.id;
  }

  const kb = await db.knowledgeBase.create({
    data: { name: name.trim(), projectId: pid },
  });

  return Response.json(kb, { status: 201 });
}

// DELETE — 删除知识库（含所有文档和 chunks）
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const kb = await db.knowledgeBase.findFirst({
    where: { id, project: { userId: session.user.id } },
  });
  if (!kb) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Prisma cascade delete 会自动删除关联的 Document 和 DocumentChunk
  await db.knowledgeBase.delete({ where: { id } });

  return Response.json({ success: true });
}
