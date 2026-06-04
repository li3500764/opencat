import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { z } from "zod/v4";
import { redis } from "@/lib/redis";

// GET — 获取用户的后台长任务列表
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 尝试从真实数据库获取（必须先执行过 pnpm prisma db push）
    const tasks = await db.backgroundTask.findMany({
      where: {
        project: {
          userId: session.user.id,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json(tasks);
  } catch (err: any) {
    console.error("查询 BackgroundTask 失败:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  agentId: z.string().optional(),
  conversationId: z.string().optional(),
  name: z.string().min(1),
  type: z.string().min(1),
  details: z.string().optional(),
});

// POST — 新增一条排队任务（仅用于模拟生成/测试真实流程）
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const task = await db.backgroundTask.create({
      data: {
        projectId: parsed.data.projectId,
        agentId: parsed.data.agentId,
        conversationId: parsed.data.conversationId,
        name: parsed.data.name,
        type: parsed.data.type,
        status: "pending",
        progress: 0,
        details: parsed.data.details,
        logs: ["[SYSTEM] 任务已加入队列，等待 Go Worker 消费..."],
      },
    });

    // 将任务推入 Redis Stream，Go Worker 会进行消费
    await redis.xadd(
      "opencat:tasks",
      "*",
      "taskId", task.id,
      "type", task.type,
      "userId", session.user.id,
      "payload", JSON.stringify({
        projectId: task.projectId,
        agentId: task.agentId,
        conversationId: task.conversationId,
        details: task.details,
      })
    );

    return Response.json(task, { status: 201 });
  } catch (err: any) {
    console.error("创建后台长任务失败:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
