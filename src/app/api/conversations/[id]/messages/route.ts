// ============================================================
// 获取对话的消息历史 + 对话元信息
// ============================================================
// 用于加载已有对话时：
// 1. 把历史消息填充到 useChat 的 initialMessages
// 2. 返回对话关联的 agentId + 最近使用的模型（恢复选择器状态）

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

  // 校验所有权，同时读取 agentId
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      project: { userId: session.user.id },
    },
    select: {
      id: true,
      agentId: true,
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

  // 从最后一条 assistant 消息中提取使用的模型
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && m.model);
  const lastModel = lastAssistantMsg?.model || null;

  return Response.json({
    messages,
    agentId: conversation.agentId || null,
    lastModel,
  });
}
