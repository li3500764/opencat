// ============================================================
// 获取对话的消息历史
// ============================================================
// 用于加载已有对话时，把历史消息填充到 useChat 的 initialMessages

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // 校验所有权
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      project: { userId: session.user.id },
    },
  });

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      model: true,
      tokenCount: true,
      createdAt: true,
    },
  });

  return Response.json(messages);
}
