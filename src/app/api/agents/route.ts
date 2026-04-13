// ============================================================
// Agents API — Agent CRUD（Day 5 核心）
// ============================================================
//
// GET  /api/agents        → 获取当前用户的所有 Agent
// POST /api/agents        → 创建新 Agent
//
// Agent 是什么？
// ---
// Agent = 一个具有特定角色的 AI 助手配置。
// 一个 Agent 包含：
//   - 系统提示词（定义 Agent 的角色和行为）
//   - 使用的 LLM 模型
//   - 可调用的工具列表
//   - 最大步数（ReAct 循环限制）
//   - 温度参数（创造性 vs 确定性）
//
// 例子：
//   - "代码助手" Agent：用 gpt-4o，有 calculator + http_request 工具
//   - "数据分析师" Agent：用 claude-3.5-sonnet，只有 calculator 工具
//   - "研究助手" Agent：用 gpt-4o-mini，有 http_request 工具
//
// 项目隔离：
// ---
// 每个 Agent 属于一个 Project。不同 Project 的 Agent 互相看不到。
// 这就是"项目隔离"的含义——每个项目有自己独立的 Agent 和配置。
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { z } from "zod/v4";

// ---------- 请求体校验 Schema ----------
// 用 Zod 确保前端传来的数据格式正确
const createAgentSchema = z.object({
  // 必填：Agent 所属项目 ID
  projectId: z.string().min(1, "projectId is required"),

  // 必填：Agent 名称，如 "代码助手"
  name: z.string().min(1, "name is required").max(50),

  // 可选：Agent 描述
  description: z.string().max(200).optional(),

  // 必填：系统提示词（定义 Agent 的角色）
  systemPrompt: z.string().min(1, "systemPrompt is required"),

  // 可选：使用的模型，默认 gpt-4o
  model: z.string().default("gpt-4o"),

  // 可选：温度参数 0-2，默认 0.7
  temperature: z.number().min(0).max(2).default(0.7),

  // 可选：最大 ReAct 步数，默认 10
  maxSteps: z.number().int().min(1).max(50).default(10),

  // 可选：工具名列表，如 ["calculator", "datetime"]
  tools: z.array(z.string()).default([]),

  // 可选：是否是 Orchestrator（编排者）
  isOrchestrator: z.boolean().default(false),
});

// GET — 获取用户的 Agent 列表
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 从 URL 参数读取可选的 projectId 过滤
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  // 查询条件：用户的项目下的 Agent
  // 如果指定了 projectId，只查该项目；否则查所有项目
  const agents = await db.agent.findMany({
    where: {
      project: {
        userId: session.user.id,
        ...(projectId ? { id: projectId } : {}),
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      systemPrompt: true,
      model: true,
      temperature: true,
      maxSteps: true,
      tools: true,
      isOrchestrator: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
      // 附带这个 Agent 关联的对话数量（方便前端显示）
      _count: { select: { conversations: true } },
    },
  });

  return Response.json(agents);
}

// POST — 创建新 Agent
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- 校验请求体 ----
  const body = await req.json();
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // ---- 校验项目所有权 ----
  // 确保 projectId 对应的项目属于当前用户
  const project = await db.project.findFirst({
    where: { id: data.projectId, userId: session.user.id },
  });
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // ---- 创建 Agent ----
  const agent = await db.agent.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      description: data.description || "",
      systemPrompt: data.systemPrompt,
      model: data.model,
      temperature: data.temperature,
      maxSteps: data.maxSteps,
      tools: data.tools,           // JSON 字段，Prisma 自动序列化
      isOrchestrator: data.isOrchestrator,
    },
  });

  return Response.json(agent, { status: 201 });
}
