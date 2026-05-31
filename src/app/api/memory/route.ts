// ============================================================
// Memory API — 用户记忆管理（Day 6 升级版）
// ============================================================
//
// GET    /api/memory?conversationId=xxx  → 获取用户的所有记忆（包括全局和该会话记忆）
// POST   /api/memory                     → 新增一条记忆（支持全局/对话级，支持附加图片）
// DELETE /api/memory                     → 删除指定记忆
// ============================================================

import { auth } from "@/lib/auth";
import { getUserMemories, deleteMemory, saveMemory } from "@/lib/memory";
import { classifyDatabaseError } from "@/server/db/errors";

function memoryErrorResponse(error: unknown) {
  const databaseError = classifyDatabaseError(error);
  if (databaseError) {
    return Response.json(
      { error: databaseError.message, code: databaseError.code },
      { status: databaseError.status }
    );
  }

  return Response.json(
    {
      error: error instanceof Error ? error.message : "Internal Server Error",
      code: "MEMORY_REQUEST_FAILED",
    },
    { status: 500 }
  );
}

// GET — 获取用户记忆列表
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId") || undefined;

  try {
    const memories = await getUserMemories(session.user.id, undefined, conversationId);
    return Response.json(memories);
  } catch (err) {
    console.error("[Memory API] Failed to list memories:", err);
    return memoryErrorResponse(err);
  }
}

// POST — 手动新增一条记忆
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { content, category, conversationId, imageUrl } = await req.json();

    if (!content || !category) {
      return Response.json({ error: "content and category are required" }, { status: 400 });
    }

    const result = await saveMemory({
      userId: session.user.id,
      content,
      category,
      conversationId: conversationId || undefined,
      imageUrl: imageUrl || undefined,
      importance: 0.8, // 用户手动添加的记忆往往具有更高的重要性
    });

    return Response.json({ success: true, id: result.id });
  } catch (err) {
    console.error("[Memory API] Failed to save memory:", err);
    return memoryErrorResponse(err);
  }
}

// DELETE — 删除记忆
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteMemory(id, session.user.id);
    if (!deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[Memory API] Failed to delete memory:", err);
    return memoryErrorResponse(err);
  }
}
