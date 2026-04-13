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
// ============================================================
//
// ★ 可配置化设计（Day 6 改进）：
// ---
// Embedding 服务不应该写死 OpenAI，理由：
//   1. 用户可能用代理平台（heiyu、one-api 等），baseUrl 不同
//   2. 国产模型也提供 Embedding（智谱、DeepSeek、百川等）
//   3. 不同模型输出维度不同（1536 / 1024 / 768 等）
//
// 配置优先级：
//   环境变量 > 用户 DB 配置的 API Key > 系统默认值
//
// 环境变量：
//   EMBEDDING_MODEL      — 模型名（默认 text-embedding-3-small）
//   EMBEDDING_DIMENSION  — 向量维度（默认 1536，必须和 Prisma schema 的 vector(N) 一致）
//   EMBEDDING_BASE_URL   — 自定义 API 端点（留空则用 OpenAI 官方）
//   EMBEDDING_API_KEY    — 专用 API Key（留空则按 provider 匹配用户 Key）
//   EMBEDDING_PROVIDER   — 匹配用户 Key 时用哪个 provider（默认 "openai"）
//
// ⚠️ 维度注意事项：
//   如果换了模型维度，Prisma schema 里的 vector(1536) 也要同步改，
//   并且已有的向量数据需要全部重新生成。
//   所以换维度是个"大动作"，不能随便改。
//
// ============================================================

import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";

// ============================================================
// Embedding 配置（从环境变量读取，有默认值兜底）
// ============================================================

// 模型名 — 默认 OpenAI text-embedding-3-small
// 常见可选值：
//   OpenAI:   text-embedding-3-small (1536), text-embedding-3-large (3072), text-embedding-ada-002 (1536)
//   DeepSeek: deepseek-embedding (1024, 预估)
//   智谱:     embedding-3 (2048)
//   百川:     baichuan-text-embedding (1024)
//   Jina:     jina-embeddings-v3 (1024)
// 只要 API 是 OpenAI 兼容格式（POST /v1/embeddings），都能用
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

// 向量维度 — 必须和 Prisma schema 的 vector(N) 一致
// 如果改了这个值，记得同步改 schema.prisma 里的 Unsupported("vector(1536)")
export const EMBEDDING_DIMENSION = parseInt(
  process.env.EMBEDDING_DIMENSION || "1536",
  10
);

// 自定义 API 端点 — 留空则用 OpenAI 官方地址
// 填了就走这个地址（代理平台、私有部署等）
// 例如：https://www.heiyucode.com/v1
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || undefined;

// 专用 Embedding API Key — 如果 Embedding 用的 Key 和 Chat 不一样，可以单独配
// 留空则走下面的 getEmbeddingApiKey 逻辑（按 provider 匹配用户 Key → 回退 OPENAI_API_KEY）
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || undefined;

// Embedding 对应的 provider 名 — 匹配用户 Key 时用
// 默认 "openai"，如果用户的 Embedding Key 存在其他 provider 下就改这个
// 例如用户把 heiyu 的 Key 存为 provider: "custom:heiyu"，
// 那就把 EMBEDDING_PROVIDER 设为 "custom:heiyu"
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";

// ============================================================
// 获取 Embedding 模型实例
// ============================================================
//
// 用 @ai-sdk/openai 的 createOpenAI 创建。
// 因为绝大多数 Embedding API 都兼容 OpenAI 格式
// （POST /v1/embeddings，请求体 { model, input }）
// 所以不管是 OpenAI 官方、代理平台、还是国产模型，
// 只要兼容这个格式，传入 baseURL 就能用。
//
function getEmbeddingModel(apiKey: string) {
  const openai = createOpenAI({
    apiKey,
    // 如果配了自定义 baseURL，走代理/私有端点
    // 没配就用 @ai-sdk/openai 的默认值（OpenAI 官方）
    ...(EMBEDDING_BASE_URL ? { baseURL: EMBEDDING_BASE_URL } : {}),
  });
  return openai.textEmbeddingModel(EMBEDDING_MODEL);
}

// ============================================================
// 获取可用的 Embedding API Key
// ============================================================
//
// 优先级（从高到低）：
//   1. 环境变量 EMBEDDING_API_KEY  → 最高优先，专用 Key
//   2. 用户在 Settings 配置的 Key  → 按 EMBEDDING_PROVIDER 匹配
//   3. 环境变量 OPENAI_API_KEY     → 兜底
//
// 为什么有这个优先级？
// → 有些场景 Embedding 和 Chat 用不同的 Key/Provider
// → 比如 Chat 用 Anthropic，但 Embedding 只能用 OpenAI 兼容接口
// → EMBEDDING_API_KEY 让运维可以直接配一个专用 Key，不依赖用户配置
//
export async function getEmbeddingApiKey(userId: string): Promise<string | null> {
  // 1. 最高优先：环境变量专用 Key
  if (EMBEDDING_API_KEY) {
    return EMBEDDING_API_KEY;
  }

  // 2. 查用户在 Settings → API Keys 里配的 Key
  //    按 EMBEDDING_PROVIDER 匹配（默认是 "openai"）
  const userKey = await db.apiKey.findFirst({
    where: { userId, provider: EMBEDDING_PROVIDER, isActive: true },
  });

  if (userKey) {
    // 解密用户存的 Key（AES-256-GCM 加密存储）
    return decrypt(userKey.encryptedKey, userKey.iv);
  }

  // 3. 兜底：环境变量 OPENAI_API_KEY
  return process.env.OPENAI_API_KEY || null;
}

// ============================================================
// 获取用户配置的 Embedding baseUrl（可选）
// ============================================================
//
// 如果用户的 API Key 配了自定义 baseUrl（比如代理平台），
// 也用于 Embedding 请求。
// 优先级：环境变量 EMBEDDING_BASE_URL > 用户 Key 的 baseUrl
//
export async function getEmbeddingBaseUrl(userId: string): Promise<string | undefined> {
  // 环境变量已经配了就直接用
  if (EMBEDDING_BASE_URL) return EMBEDDING_BASE_URL;

  // 否则看用户的 Key 有没有 baseUrl
  const userKey = await db.apiKey.findFirst({
    where: { userId, provider: EMBEDDING_PROVIDER, isActive: true },
  });

  return userKey?.baseUrl || undefined;
}

// ============================================================
// 获取完整的 Embedding 模型实例（含 Key + baseUrl 解析）
// ============================================================
//
// 这是对外的便捷方法：自动解析 Key 和 baseUrl，返回可用的模型实例。
// 如果用户的 Key 自带 baseUrl，也会用上。
//
async function resolveEmbeddingModel(userId: string) {
  const apiKey = await getEmbeddingApiKey(userId);
  if (!apiKey) return null;

  // 如果环境变量没配 baseUrl，尝试用用户 Key 上的 baseUrl
  const userBaseUrl = await getEmbeddingBaseUrl(userId);

  const openai = createOpenAI({
    apiKey,
    ...(userBaseUrl ? { baseURL: userBaseUrl } : {}),
  });

  return openai.textEmbeddingModel(EMBEDDING_MODEL);
}

// ============================================================
// 生成单条文本的向量
// ============================================================
//
// 输入：一段文字 + apiKey（或用 resolveEmbeddingModel 自动解析）
// 输出：N 维浮点数数组（维度由 EMBEDDING_DIMENSION 决定）
//
// 使用 AI SDK 的 embed() 函数，底层调用 OpenAI 兼容的 /v1/embeddings
//
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const model = getEmbeddingModel(apiKey);

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
// embedMany 会一次性把所有文本发给 API，效率远高于逐个 embed
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
// 便捷方法：自动解析用户配置，生成单条向量
// ============================================================
//
// 与 generateEmbedding 的区别：不需要手动传 apiKey，
// 自动走 getEmbeddingApiKey 解析链。
// 适合在 Chat API 等场景直接调用。
//
export async function generateEmbeddingForUser(
  text: string,
  userId: string
): Promise<number[] | null> {
  const model = await resolveEmbeddingModel(userId);
  if (!model) return null;

  try {
    const result = await embed({ model, value: text });
    return result.embedding;
  } catch (err) {
    console.error("[Embedding] Failed to generate embedding:", err);
    return null;
  }
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
