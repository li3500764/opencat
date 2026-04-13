// ============================================================
// Agent 单个操作 API — 查/改/删（Day 5）
// ============================================================
//
// GET    /api/agents/[id]  → 获取单个 Agent 详情
// PUT    /api/agents/[id]  → 更新 Agent 配置
// DELETE /api/agents/[id]  → 删除 Agent
//
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { z } from "zod/v4";

// ---------- 更新 Schema ----------
// 所有字段可选（partial update），只更新前端传了的字段
const updateAgentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  systemPrompt: z.string().min(1).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  tools: z.array(z.string()).optional(),
  isOrchestrator: z.boolean().optional(),
});

// ---------- 通用鉴权 + 所有权校验 ----------
// 封装成函数，三个路由都要用
async function getOwnedAgent(agentId: string, userId: string) {
  return db.agent.findFirst({
    where: {
      id: agentId,
      project: { userId },
    },
  });
}

// GET — 获取单个 Agent 详情
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const agent = await getOwnedAgent(id, session.user.id);
  if (!agent) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(agent);
}

// PUT — 更新 Agent 配置
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 校验所有权
  const existing = await getOwnedAgent(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // 校验请求体
  const body = await req.json();
  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  // 只更新前端传了的字段
  // Object.fromEntries + filter 过滤掉 undefined 的字段
  const updateData = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  const agent = await db.agent.update({
    where: { id },
    data: updateData,
  });

  return Response.json(agent);
}

// DELETE — 删除 Agent
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getOwnedAgent(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.agent.delete({ where: { id } });
  return Response.json({ success: true });
}
