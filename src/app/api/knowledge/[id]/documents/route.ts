// ============================================================
// Document Upload API — 文档上传 + 处理（Day 6）
// ============================================================
//
// POST /api/knowledge/[id]/documents
// 上传文本文件到指定知识库，自动分块 + 向量化
//
// 支持的格式：.txt, .md（纯文本直接处理）
// PDF 支持预留接口，但当前只处理文本内容
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { redis } from "@/lib/redis";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: knowledgeBaseId } = await params;

  // 校验知识库归属并获取项目 ID
  const kb = await db.knowledgeBase.findFirst({
    where: { id: knowledgeBaseId, project: { userId: session.user.id } },
    select: { id: true, projectId: true },
  });
  if (!kb) {
    return Response.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  // 读取请求体
  const contentType = req.headers.get("content-type") || "";

  let fileName: string;
  let fileType: string;
  let content: string;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    fileName = body.fileName || "untitled.txt";
    fileType = body.fileType || "txt";
    content = body.content || "";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    fileName = file.name;
    fileType = file.name.split(".").pop() || "txt";
    content = await file.text();
  } else {
    return Response.json({ error: "Unsupported content type" }, { status: 400 });
  }

  if (!content.trim()) {
    return Response.json({ error: "Empty document content" }, { status: 400 });
  }

  try {
    // 1. 创建 Document 记录，状态设为 pending
    const document = await db.document.create({
      data: {
        knowledgeBaseId,
        fileName,
        fileType,
        fileSize: Buffer.byteLength(content, "utf-8"),
        status: "pending",
      },
    });

    // 2. 创建异步 BackgroundTask
    const task = await db.backgroundTask.create({
      data: {
        projectId: kb.projectId,
        name: `知识库 RAG 文档语义向量化: ${fileName}`,
        type: "rag-ingest",
        status: "pending",
        progress: 0,
        details: JSON.stringify({
          documentId: document.id,
          content: content,
          userId: session.user.id,
          knowledgeBaseId,
          fileName,
          fileType,
        }),
        logs: ["[SYSTEM] 异步文档 RAG 向量任务已创建，准备分派给后台执行器..."],
      },
    });

    // 3. 推入 Redis Stream 派发给 Go Worker 消费
    await redis.xadd(
      "opencat:tasks",
      "*",
      "taskId", task.id,
      "type", task.type,
      "userId", session.user.id,
      "payload", task.details!
    );

    return Response.json({ documentId: document.id, taskId: task.id }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: `Document processing queue failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// GET — 获取知识库下的文档列表
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: knowledgeBaseId } = await params;

  const documents = await db.document.findMany({
    where: {
      knowledgeBaseId,
      knowledgeBase: { project: { userId: session.user.id } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      chunkCount: true,
      status: true,
      createdAt: true,
    },
  });

  return Response.json(documents);
}
