// ============================================================
// Tools API — 获取可用工具列表
// ============================================================
//
// GET /api/tools
// 返回所有已注册的工具及其状态
// 前端用这个接口显示"当前 Agent 有哪些工具可用"
// ============================================================

import { auth } from "@/lib/auth";
import { getAvailableTools } from "@/lib/agent";

// GET — 获取工具列表
export async function GET() {
  // 鉴权
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 从 Agent 模块获取所有已注册的工具
  const tools = getAvailableTools();

  return Response.json({ tools });
}
