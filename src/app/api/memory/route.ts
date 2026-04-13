// ============================================================
// Memory API — 用户记忆管理（Day 6）
// ============================================================
//
// GET    /api/memory  → 获取用户的所有记忆
// DELETE /api/memory  → 删除指定记忆
// ============================================================

import { auth } from "@/lib/auth";
import { getUserMemories, deleteMemory } from "@/lib/memory";

// GET — 获取用户记忆列表
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await getUserMemories(session.user.id);
  return Response.json(memories);
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

  const deleted = await deleteMemory(id, session.user.id);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
