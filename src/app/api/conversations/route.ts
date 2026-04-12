// ============================================================
// Conversations API — 对话列表
// ============================================================
// GET  → 返回当前用户的所有对话（侧边栏用）
// POST → 创建新对话（预留，目前新对话在 /api/chat 里自动创建）

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

// 获取用户的对话列表
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 通过 Project 关联查对话（对话属于项目，项目属于用户）
  const conversations = await db.conversation.findMany({
    where: {
      project: { userId: session.user.id },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { messages: true },
      },
    },
  });

  return Response.json(conversations);
}

// 删除对话
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await req.json();
  if (!conversationId) {
    return Response.json({ error: "conversationId required" }, { status: 400 });
  }

  // 校验所有权：对话 → 项目 → 用户
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      project: { userId: session.user.id },
    },
  });

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.conversation.delete({ where: { id: conversationId } });

  return Response.json({ success: true });
}
