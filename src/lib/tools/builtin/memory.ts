// ============================================================
// Memory 内置工具：memory_save + memory_search（Day 6）
// ============================================================
//
// 这两个工具让 Agent 在对话过程中主动管理记忆：
//
// memory_save：
//   Agent 发现用户说了重要信息 → 调用 memory_save 存储
//   例如用户说"我是杭州的前端开发" → Agent 调用 memory_save 存储这条信息
//
// memory_search：
//   Agent 需要回忆用户信息时 → 调用 memory_search 搜索
//   例如用户问"你还记得我做什么的吗" → Agent 调用 memory_search 查找
//
// 为什么用工具而不是自动保存？
// → 让 LLM 自己判断什么信息值得记住（人类也不是什么都记）
// → Agent 可以选择合适的 category 和 importance
// → 面试亮点：Agent 自主决策的能力
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { saveMemory, searchRelevantMemories } from "../../memory/store";

// ============================================================
// memory_save — 保存记忆
// ============================================================
const memorySaveSchema = z.object({
  // 要记住的内容
  content: z
    .string()
    .describe("要记住的信息内容，用简洁的陈述句，如 '用户是杭州的前端开发者'"),

  // 记忆分类
  category: z
    .enum(["preference", "background", "behavior", "project_context", "fact"])
    .describe(
      "记忆分类：" +
        "preference=用户偏好（喜欢/不喜欢），" +
        "background=背景信息（职业/城市），" +
        "behavior=行为模式，" +
        "project_context=项目相关，" +
        "fact=事实信息"
    ),

  // 重要程度 0-1
  importance: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("重要程度 0-1，0.5=普通，0.8+=很重要，1.0=关键信息"),
});

type MemorySaveInput = z.infer<typeof memorySaveSchema>;

export const memorySaveTool: ToolDefinition<MemorySaveInput> = {
  name: "memory_save",

  description:
    "保存关于用户的重要信息到长期记忆。" +
    "当用户提到个人信息、偏好、背景、工作内容等值得记住的信息时使用。" +
    "不要保存临时性的、无关紧要的信息。只保存对未来对话有帮助的内容。",

  parameters: memorySaveSchema,

  execute: async (input, context) => {
    try {
      const result = await saveMemory({
        userId: context.userId,
        content: input.content,
        category: input.category,
        importance: input.importance,
        projectId: context.projectId,
      });

      return {
        success: true,
        data: {
          id: result.id,
          message: `已记住: "${input.content}"`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `保存记忆失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};

// ============================================================
// memory_search — 搜索记忆
// ============================================================
const memorySearchSchema = z.object({
  // 搜索关键词/描述
  query: z
    .string()
    .describe("要搜索的内容描述，如 '用户的职业' 或 '用户的偏好'"),

  // 返回数量
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("返回结果数量，默认 5"),
});

type MemorySearchInput = z.infer<typeof memorySearchSchema>;

export const memorySearchTool: ToolDefinition<MemorySearchInput> = {
  name: "memory_search",

  description:
    "搜索已保存的用户记忆。" +
    "当需要回忆用户的个人信息、偏好或之前的对话内容时使用。" +
    "使用语义搜索，不需要精确关键词匹配。",

  parameters: memorySearchSchema,

  execute: async (input, context) => {
    try {
      const memories = await searchRelevantMemories(
        input.query,
        context.userId,
        {
          limit: input.limit,
          projectId: context.projectId,
        }
      );

      if (memories.length === 0) {
        return {
          success: true,
          data: { memories: [], message: "没有找到相关记忆" },
        };
      }

      return {
        success: true,
        data: {
          memories: memories.map((m) => ({
            content: m.content,
            category: m.category,
            importance: m.importance,
            similarity: Math.round(m.similarity * 100) / 100,
          })),
          count: memories.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `搜索记忆失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
