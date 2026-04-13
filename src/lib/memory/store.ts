// ============================================================
// Memory Store — 记忆存储与检索（Day 6 核心）
// ============================================================
//
// Memory 系统做什么？
// ---
// 让 AI Agent 像人一样"记住"用户的信息。
//
// 类比：
//   你跟朋友聊天，朋友会记住你喜欢什么、做什么工作、最近在忙什么。
//   Memory 系统就是让 Agent 具备这种能力。
//
// 工作流程：
//   1. 保存记忆：Agent 在对话中发现重要信息 → 调用 memory_save 工具存储
//   2. 检索记忆：新对话开始时，根据用户消息搜索相关记忆 → 注入到系统提示词
//   3. 向量搜索：不是关键词匹配，而是语义搜索（"我在杭州" 能匹配 "用户的所在城市"）
//
// 记忆分类（MemoryCategory 枚举）：
//   - preference: 偏好（"喜欢简洁风格"、"不要紫色"）
//   - background: 背景（"前端开发"、"在杭州"）
//   - behavior:   行为模式（"经常催进度"）
//   - project_context: 项目上下文
//   - fact:       事实信息
//
// ============================================================

import { db } from "@/server/db";
import {
  generateEmbedding,
  searchMemories,
  getEmbeddingApiKey,
} from "./embedding";

// ---------- Memory 类型定义 ----------
export interface MemoryInput {
  userId: string;
  content: string;
  category: "preference" | "background" | "behavior" | "project_context" | "fact";
  importance?: number;      // 0-1，默认 0.5
  projectId?: string;       // 关联项目（可选）
}

export interface MemorySearchResult {
  id: string;
  content: string;
  category: string;
  importance: number;
  similarity: number;
}

// ============================================================
// 保存记忆
// ============================================================
//
// 步骤：
//   1. 获取 Embedding API Key
//   2. 将记忆内容转成向量
//   3. 用原生 SQL 插入（因为 Prisma 不直接支持 vector 类型）
//
export async function saveMemory(input: MemoryInput): Promise<{ id: string }> {
  const apiKey = await getEmbeddingApiKey(input.userId);

  let embeddingVector: number[] | null = null;

  // 如果有 API Key，生成向量嵌入
  // 没有 Key 也能存记忆（只是没法向量搜索，只能按 category 查）
  if (apiKey) {
    try {
      embeddingVector = await generateEmbedding(input.content, apiKey);
    } catch (err) {
      console.error("[Memory] Embedding generation failed:", err);
      // 降级：不存向量，仍然存文本
    }
  }

  if (embeddingVector) {
    // 有向量：用原生 SQL 插入（Prisma 不支持 vector 类型的写入）
    const vectorStr = `[${embeddingVector.join(",")}]`;
    const id = generateId();

    await db.$executeRaw`
      INSERT INTO "Memory" (id, "userId", "projectId", content, embedding, category, importance, "createdAt")
      VALUES (
        ${id},
        ${input.userId},
        ${input.projectId || null},
        ${input.content},
        ${vectorStr}::vector,
        ${input.category}::"MemoryCategory",
        ${input.importance ?? 0.5},
        NOW()
      )
    `;

    return { id };
  } else {
    // 无向量：用 Prisma ORM 插入（embedding 字段留空）
    const memory = await db.memory.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        content: input.content,
        category: input.category,
        importance: input.importance ?? 0.5,
      },
    });

    return { id: memory.id };
  }
}

// ============================================================
// 搜索相关记忆
// ============================================================
//
// 输入：用户最新的消息文本
// 输出：与这条消息语义最相关的记忆列表
//
// 用途：在每次对话时，自动检索相关记忆注入到系统提示词
// 让 Agent "想起来"关于这个用户的相关信息
//
export async function searchRelevantMemories(
  query: string,
  userId: string,
  options: {
    limit?: number;
    projectId?: string;
    minSimilarity?: number;
  } = {}
): Promise<MemorySearchResult[]> {
  const apiKey = await getEmbeddingApiKey(userId);

  if (!apiKey) {
    // 没有 API Key，无法进行向量搜索
    // 降级：返回最近的记忆
    return getFallbackMemories(userId, options.limit ?? 5, options.projectId);
  }

  try {
    // 1. 将查询文本转成向量
    const queryEmbedding = await generateEmbedding(query, apiKey);

    // 2. 用向量在 Memory 表中搜索最相似的记录
    return await searchMemories(queryEmbedding, userId, {
      limit: options.limit ?? 5,
      projectId: options.projectId,
      minSimilarity: options.minSimilarity ?? 0.3,
    });
  } catch (err) {
    console.error("[Memory] Search failed:", err);
    return getFallbackMemories(userId, options.limit ?? 5, options.projectId);
  }
}

// ---------- 降级方案：按时间返回最近记忆 ----------
async function getFallbackMemories(
  userId: string,
  limit: number,
  projectId?: string
): Promise<MemorySearchResult[]> {
  const memories = await db.memory.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [
      { importance: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      content: true,
      category: true,
      importance: true,
    },
  });

  return memories.map((m) => ({
    ...m,
    similarity: 0, // 降级模式没有相似度
  }));
}

// ============================================================
// 获取用户所有记忆（管理用）
// ============================================================
export async function getUserMemories(
  userId: string,
  projectId?: string
) {
  return db.memory.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      category: true,
      importance: true,
      createdAt: true,
    },
  });
}

// ============================================================
// 删除记忆
// ============================================================
export async function deleteMemory(id: string, userId: string): Promise<boolean> {
  const memory = await db.memory.findFirst({
    where: { id, userId },
  });
  if (!memory) return false;

  await db.memory.delete({ where: { id } });
  return true;
}

// ============================================================
// 格式化记忆为系统提示词片段
// ============================================================
//
// 将搜索到的记忆格式化成文本，注入到系统提示词中
// Agent 在回复时就能参考这些记忆
//
export function formatMemoriesForPrompt(memories: MemorySearchResult[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => {
    const tag = `[${m.category}]`;
    return `${tag} ${m.content}`;
  });

  return (
    "\n\n---\n" +
    "以下是你对当前用户的记忆，请在回复时参考这些信息：\n" +
    lines.join("\n") +
    "\n---"
  );
}

// ---------- ID 生成器 ----------
function generateId(): string {
  // cuid 格式的简易替代
  return (
    "cm" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}
