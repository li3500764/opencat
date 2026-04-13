// ============================================================
// RAG 系统 — 文档分块 + 向量化 + 检索（Day 6 核心）
// ============================================================
//
// 什么是 RAG（Retrieval-Augmented Generation）？
// ---
// RAG = 检索增强生成。简单说就是：
//   让 AI 先"查资料"再回答问题，而不是纯靠自己的知识。
//
// 工作流程：
//   1. 用户上传文档（PDF/TXT/MD）
//   2. 文档被切成小块（chunks），每块约 500 字
//   3. 每个 chunk 转成向量（embedding）存到 pgvector
//   4. 用户提问时，把问题也转成向量
//   5. 在数据库里找最相似的 chunks（语义搜索）
//   6. 把找到的 chunks 注入到 system prompt → AI 参考这些内容回答
//
// 为什么要分块？
// → LLM 有 context window 限制，不能把整个文档塞进去
// → 分块后只取最相关的几段，既精准又省 token
//
// ============================================================

import { db } from "@/server/db";
import {
  generateEmbeddings,
  getEmbeddingApiKey,
  generateEmbedding,
  searchDocumentChunks,
} from "./embedding";

// ---------- 分块配置 ----------
// 每个 chunk 的最大字符数
const CHUNK_SIZE = 500;
// 相邻 chunk 的重叠字符数
// 重叠的目的：避免一句话被切断，导致语义丢失
const CHUNK_OVERLAP = 50;

// ============================================================
// 文本分块函数
// ============================================================
//
// 把一段长文本切成固定大小的小块
// 使用滑动窗口法：每次向前移 (CHUNK_SIZE - OVERLAP) 个字符
//
// 例子（CHUNK_SIZE=10, OVERLAP=3）：
//   "ABCDEFGHIJKLMNOP"
//   → ["ABCDEFGHIJ", "HIJKLMNOP"]
//       ↑ 前10个          ↑ 从第8个开始（重叠3个：HIJ）
//
export function splitTextIntoChunks(text: string): string[] {
  // 先清理文本：去掉多余空白
  const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length <= CHUNK_SIZE) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    // 取一块
    let end = start + CHUNK_SIZE;

    // 如果不是最后一块，尝试在句号/换行处断开（避免切断句子）
    if (end < cleaned.length) {
      // 从 end 位置往前找最近的句号、换行或句尾标点
      const searchRange = cleaned.slice(start, end);
      const lastBreak = Math.max(
        searchRange.lastIndexOf("。"),
        searchRange.lastIndexOf("\n"),
        searchRange.lastIndexOf(". "),
        searchRange.lastIndexOf("！"),
        searchRange.lastIndexOf("？"),
      );

      // 如果找到了合适的断点，且不会让 chunk 太短（至少 CHUNK_SIZE/2）
      if (lastBreak > CHUNK_SIZE / 2) {
        end = start + lastBreak + 1;
      }
    }

    chunks.push(cleaned.slice(start, end).trim());
    // 下一块的起始位置 = 当前结束位置 - 重叠
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter((c) => c.length > 0);
}

// ============================================================
// 处理上传的文档
// ============================================================
//
// 完整流程：
//   1. 创建 Document 记录（status = "processing"）
//   2. 文本分块
//   3. 批量向量化（调 OpenAI Embeddings API）
//   4. 写入 DocumentChunk 表（含向量）
//   5. 更新 Document 状态为 "ready"
//
// 错误处理：如果任何步骤失败，Document 状态改为 "error"
//
export async function processDocument(
  knowledgeBaseId: string,
  fileName: string,
  fileType: string,
  content: string,
  userId: string
): Promise<{ documentId: string; chunkCount: number }> {
  // ---- 1. 创建 Document 记录 ----
  const document = await db.document.create({
    data: {
      knowledgeBaseId,
      fileName,
      fileType,
      fileSize: Buffer.byteLength(content, "utf-8"),
      status: "processing",
    },
  });

  try {
    // ---- 2. 文本分块 ----
    const chunks = splitTextIntoChunks(content);

    if (chunks.length === 0) {
      await db.document.update({
        where: { id: document.id },
        data: { status: "error" },
      });
      throw new Error("文档内容为空，无法分块");
    }

    // ---- 3. 批量向量化 ----
    const apiKey = await getEmbeddingApiKey(userId);
    let embeddings: number[][] | null = null;

    if (apiKey) {
      try {
        embeddings = await generateEmbeddings(chunks, apiKey);
      } catch (err) {
        console.error("[RAG] Batch embedding failed:", err);
        // 降级：不存向量，仍然存文本（关键词搜索仍可用）
      }
    }

    // ---- 4. 写入 DocumentChunk（批量） ----
    if (embeddings) {
      // 有向量：用原生 SQL 批量插入
      for (let i = 0; i < chunks.length; i++) {
        const vectorStr = `[${embeddings[i].join(",")}]`;
        const id = generateId();
        await db.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex")
          VALUES (
            ${id},
            ${document.id},
            ${chunks[i]},
            ${vectorStr}::vector,
            ${i}
          )
        `;
      }
    } else {
      // 无向量：用 Prisma ORM 批量创建
      await db.documentChunk.createMany({
        data: chunks.map((text, i) => ({
          documentId: document.id,
          content: text,
          chunkIndex: i,
        })),
      });
    }

    // ---- 5. 更新 Document 状态 ----
    await db.document.update({
      where: { id: document.id },
      data: {
        status: "ready",
        chunkCount: chunks.length,
      },
    });

    return { documentId: document.id, chunkCount: chunks.length };
  } catch (err) {
    // 失败：标记 Document 为 error
    await db.document.update({
      where: { id: document.id },
      data: { status: "error" },
    });
    throw err;
  }
}

// ============================================================
// RAG 检索 — 根据用户问题查找相关文档片段
// ============================================================
//
// 这是 RAG 的核心查询函数
// 会在 Chat API 中调用，把检索到的内容注入到系统提示词
//
export async function retrieveRelevantChunks(
  query: string,
  knowledgeBaseId: string,
  userId: string,
  options: { limit?: number; minSimilarity?: number } = {}
): Promise<Array<{ content: string; similarity: number; chunkIndex: number }>> {
  const apiKey = await getEmbeddingApiKey(userId);

  if (!apiKey) {
    // 无 API Key，降级为文本匹配（简单 LIKE 搜索）
    return getFallbackChunks(query, knowledgeBaseId, options.limit ?? 5);
  }

  try {
    // 1. 将查询转成向量
    const queryEmbedding = await generateEmbedding(query, apiKey);

    // 2. 向量相似度搜索
    return await searchDocumentChunks(queryEmbedding, knowledgeBaseId, {
      limit: options.limit ?? 5,
      minSimilarity: options.minSimilarity ?? 0.3,
    });
  } catch (err) {
    console.error("[RAG] Retrieval failed:", err);
    return getFallbackChunks(query, knowledgeBaseId, options.limit ?? 5);
  }
}

// ---------- 降级：简单文本匹配 ----------
async function getFallbackChunks(
  query: string,
  knowledgeBaseId: string,
  limit: number
) {
  // 取查询中的关键词（简单切分）
  const keywords = query.split(/\s+/).filter((w) => w.length > 1);

  const chunks = await db.documentChunk.findMany({
    where: {
      document: { knowledgeBaseId },
      ...(keywords.length > 0
        ? {
            OR: keywords.map((kw) => ({
              content: { contains: kw },
            })),
          }
        : {}),
    },
    orderBy: { chunkIndex: "asc" },
    take: limit,
    select: {
      content: true,
      chunkIndex: true,
    },
  });

  return chunks.map((c) => ({ ...c, similarity: 0 }));
}

// ============================================================
// 格式化检索结果为系统提示词片段
// ============================================================
export function formatChunksForPrompt(
  chunks: Array<{ content: string; similarity: number }>
): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map((c, i) => `[文档片段 ${i + 1}] ${c.content}`)
    .join("\n\n");

  return (
    "\n\n---\n" +
    "以下是从知识库中检索到的相关参考资料：\n\n" +
    formatted +
    "\n\n请根据以上资料回答用户的问题。如果资料不足以回答，请说明。\n---"
  );
}

// ---------- ID 生成器 ----------
function generateId(): string {
  return (
    "cm" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}
