// ============================================================
// Embedding Service — 向量嵌入服务（Day 6 核心）
// ============================================================
//
// 什么是 Embedding（向量嵌入）？
// ---
// Embedding 就是把一段文字变成一组数字（向量）。
// 比如："我喜欢吃苹果" → [0.12, -0.34, 0.56, ... ] （1536 个数字）
//
// 为什么需要它？
// → 计算机不理解中文，但能算数字之间的距离
// → 把文字变成向量后，语义相近的文字，向量也相近
// → "我喜欢吃苹果" 和 "我爱水果" 的向量距离就很近
// → "我喜欢吃苹果" 和 "量子力学" 的向量距离就很远
//
// 用在哪里？
// → Memory 系统：把用户信息变成向量存进数据库，搜索时按语义匹配
// → RAG 知识库：把文档内容变成向量，用户提问时找最相关的文档段落
//
// 为什么是 1536 维？
// → OpenAI 的 text-embedding-3-small 模型输出 1536 维向量
// → Prisma schema 里也定义了 vector(1536)
// → 这是行业标准尺寸，平衡了精度和存储成本
//
// ============================================================

import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/server/db";

// ---------- 向量维度常量 ----------
export const EMBEDDING_DIMENSION = 1536;

// ---------- 嵌入模型名 ----------
// text-embedding-3-small 是 OpenAI 最新的轻量嵌入模型：
// - 1536 维，精度足够
// - 价格便宜：$0.02 / 百万 tokens
// - 速度快
const EMBEDDING_MODEL = "text-embedding-3-small";

// ============================================================
// 获取 Embedding 模型实例
// ============================================================
//
// 为什么需要这个函数？
// → Embedding 需要 API Key，但 Key 可能来自用户配置或环境变量
// → 这个函数根据传入的 apiKey 创建模型实例
//
function getEmbeddingModel(apiKey: string) {
  const openai = createOpenAI({ apiKey });
  return openai.textEmbeddingModel(EMBEDDING_MODEL);
}

// ============================================================
// 获取可用的 Embedding API Key
// ============================================================
//
// 优先级：用户的 OpenAI Key → 环境变量的 OPENAI_API_KEY
// 因为 Embedding 只支持 OpenAI（暂时），所以只查 OpenAI 的 Key
//
import { decrypt } from "@/lib/crypto";

export async function getEmbeddingApiKey(userId: string): Promise<string | null> {
  // 1. 查用户的 OpenAI Key
  const userKey = await db.apiKey.findFirst({
    where: { userId, provider: "openai", isActive: true },
  });

  if (userKey) {
    return decrypt(userKey.encryptedKey, userKey.iv);
  }

  // 2. 回退到环境变量
  return process.env.OPENAI_API_KEY || null;
}

// ============================================================
// 生成单条文本的向量
// ============================================================
//
// 输入：一段文字
// 输出：1536 维浮点数数组
//
// 使用 AI SDK 的 embed() 函数，底层调用 OpenAI Embeddings API
//
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const model = getEmbeddingModel(apiKey);

  // AI SDK 的 embed() 函数
  // 发送文本到 OpenAI，返回 { embedding: number[], usage: { tokens } }
  const result = await embed({
    model,
    value: text,
  });

  return result.embedding;
}

// ============================================================
// 批量生成向量
// ============================================================
//
// 用于 RAG 文档分块后的批量向量化
// embedMany 会自动处理并发和速率限制
//
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = getEmbeddingModel(apiKey);

  const result = await embedMany({
    model,
    values: texts,
  });

  return result.embeddings;
}

// ============================================================
// pgvector 相似度搜索
// ============================================================
//
// 什么是余弦相似度（cosine similarity）？
// ---
// 两个向量的"方向"越接近，余弦相似度越大（最大 1.0 = 完全相同方向）
// pgvector 用 <=> 操作符计算余弦距离（= 1 - 余弦相似度）
//
// 为什么用 cosine 而不是 L2 距离？
// → cosine 只看方向不看长度，对文本嵌入更合适
// → 长短文本的向量长度不同，但如果语义相近，方向（cosine）还是接近
//
// 下面这两个函数是通用的向量搜索函数，
// Memory 和 RAG 都会调用它们。
//

// ---------- 搜索 Memory 表 ----------
export async function searchMemories(
  embedding: number[],
  userId: string,
  options: {
    limit?: number;
    projectId?: string;
    category?: string;
    minSimilarity?: number;
  } = {}
): Promise<Array<{ id: string; content: string; category: string; importance: number; similarity: number }>> {
  const {
    limit = 5,
    projectId,
    category,
    minSimilarity = 0.3, // 最低相似度阈值，低于这个的不返回
  } = options;

  // 将 JS 数组转成 pgvector 格式的字符串：[0.1,0.2,0.3,...]
  const vectorStr = `[${embedding.join(",")}]`;

  // 使用 Prisma 的 $queryRaw 执行原生 SQL
  // 因为 pgvector 的操作符 <=> 不是 Prisma ORM 支持的
  //
  // SQL 解释：
  //   1 - (embedding <=> $vector) = 余弦相似度
  //   <=> 返回的是"距离"（0 = 完全相同），所以 1 - distance = similarity
  //   ORDER BY embedding <=> $vector = 按距离从近到远排序
  //
  const results = await db.$queryRaw<
    Array<{
      id: string;
      content: string;
      category: string;
      importance: number;
      similarity: number;
    }>
  >`
    SELECT
      id,
      content,
      category,
      importance,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM "Memory"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      ${projectId ? db.$queryRaw`AND "projectId" = ${projectId}` : db.$queryRaw``}
      ${category ? db.$queryRaw`AND category = ${category}` : db.$queryRaw``}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  // 过滤低于最低相似度阈值的结果
  return results.filter((r) => r.similarity >= minSimilarity);
}

// ---------- 搜索 DocumentChunk 表（RAG 用） ----------
export async function searchDocumentChunks(
  embedding: number[],
  knowledgeBaseId: string,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<Array<{ id: string; content: string; chunkIndex: number; similarity: number; documentId: string }>> {
  const {
    limit = 5,
    minSimilarity = 0.3,
  } = options;

  const vectorStr = `[${embedding.join(",")}]`;

  const results = await db.$queryRaw<
    Array<{
      id: string;
      content: string;
      chunkIndex: number;
      similarity: number;
      documentId: string;
    }>
  >`
    SELECT
      dc.id,
      dc.content,
      dc."chunkIndex" as "chunkIndex",
      dc."documentId" as "documentId",
      1 - (dc.embedding <=> ${vectorStr}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    WHERE d."knowledgeBaseId" = ${knowledgeBaseId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results.filter((r) => r.similarity >= minSimilarity);
}
