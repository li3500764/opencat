import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { z } from "zod/v4";

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
    // 如果 Prisma 表还没建（未执行 db push），为了防止页面崩溃，直接返回 Mock 兜底数据，
    // 其中一个是专门指向最近会话的 Mock，如果当前用户有 Conversation 记录，我们拿最新的那条塞给它
    console.warn("BackgroundTask 查询失败，可能是因为未执行 db push，返回 Mock 数据:", err.message);
    
    let mockConversationId = "";
    try {
      const lastConv = await db.conversation.findFirst({
         where: { project: { userId: session.user.id } },
         orderBy: { createdAt: "desc" }
      });
      if (lastConv) mockConversationId = lastConv.id;
    } catch(e) {}

    const mockTasks = [
      {
        id: "task-mock-1",
        name: "AI 行业智能情报周报抓取与总结 (Mock)",
        type: "Web Scraper Agent",
        status: "running",
        progress: 88,
        savedTime: "1.5 hours",
        details: "正在抓取 HackerNews 与 TechCrunch 今日科技资讯，并分析前沿趋势...",
        conversationId: mockConversationId || undefined,
        logs: [
          "[19:20:01] [SYSTEM] 启动自主 Agent 定时抓取任务...",
          "[19:20:03] [THOUGHT] 需要获取最新科技进展。执行 web_search / http_request 工具...",
          "[19:20:28] [SYSTEM] AI 智能周报报告大纲生成中（进度 88%）..."
        ]
      },
      {
        id: "task-mock-2",
        name: "OpenCat 知识库文档语义切片向量化 (Mock)",
        type: "RAG Ingestion Pipeline",
        status: "completed",
        progress: 100,
        savedTime: "0.8 hours",
        details: "对新上传的 pdf / md 手册进行解析，切分为 45 个文本块并存入向量空间。",
        conversationId: mockConversationId || undefined,
        logs: [
          "[16:05:00] [SYSTEM] 检测到新文档上传...",
          "[16:05:12] [SYSTEM] HNSW 索引更新完成！检索通路已就绪。任务执行完毕！"
        ]
      }
    ];

    return Response.json(mockTasks);
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
        status: "running",
        progress: 10,
        details: parsed.data.details,
        logs: ["[SYSTEM] 任务已加入队列等待执行..."],
      },
    });
    return Response.json(task, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
