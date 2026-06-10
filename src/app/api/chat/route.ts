// ============================================================
// Chat API — SSE 流式对话（Day 6: Memory + RAG 注入）
// ============================================================
//
// Day 6 升级：
// 1. 每次对话前，自动检索相关 Memory 注入到系统提示词
// 2. 如果项目有 KnowledgeBase，检索相关文档片段注入
// 3. memory_save / memory_search 工具自动可用
// 4. 新增 knowledgeBaseId 参数
// ============================================================

import { convertToModelMessages, type UIMessage } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { classifyDatabaseError } from "@/server/db/errors";
import { decrypt, isEncryptionConfigError } from "@/lib/crypto";
import { createModel, getProviderForModel, calculateCost, type ApiFormat, type ModelInfo } from "@/lib/llm";
import { createAgentStream } from "@/lib/agent";
import type { SubAgentInfo } from "@/lib/tools";
import type { ApiKey } from "@prisma/client";
import {
  searchRelevantMemories,
  formatMemoriesForPrompt,
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "@/lib/memory";

export async function POST(req: Request) {
  try {
    return await handleChatRequest(req);
  } catch (error) {
    const databaseError = classifyDatabaseError(error);
    if (databaseError) {
      console.error("[Chat API] Database error:", error);
      return Response.json(
        { error: databaseError.message, code: databaseError.code },
        { status: databaseError.status }
      );
    }

    if (isEncryptionConfigError(error)) {
      return Response.json(
        {
          error:
            "Server encryption is not configured. Set ENCRYPTION_KEY to a 64-character hex string, then restart the app.",
          code: "ENCRYPTION_CONFIG_ERROR",
        },
        { status: 503 }
      );
    }

    console.error("[Chat API] Request failed:", error);
    return Response.json(
      { 
        error: "Chat request failed", 
        code: "CHAT_REQUEST_FAILED",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function handleChatRequest(req: Request) {
  // ---- 1. 鉴权 ----
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // ---- 2. 解析请求体 ----
  const body = await req.json();
  const {
    messages,
    conversationId: existingConvId,
    modelId: requestedModel,
    agentId,
    enableTools = true,
    toolNames,
    knowledgeBaseId,             // ★ Day 6 新增
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    modelId?: string;
    agentId?: string;
    enableTools?: boolean;
    toolNames?: string[];
    knowledgeBaseId?: string;    // ★ Day 6 新增
    id?: string;
    trigger?: string;
  };

  if (!messages?.length) {
    return new Response("Messages required", { status: 400 });
  }

  // ---- 3. 加载 Agent 配置 ----
  let agentConfig: {
    systemPrompt?: string;
    model: string;
    toolNames: string[];
    maxSteps: number;
    temperature: number;
    isOrchestrator: boolean;
  } | null = null;
  let currentAgent: { id: string; projectId: string } | null = null;

  if (agentId) {
    const agent = await db.agent.findFirst({
      where: { id: agentId, project: { userId } },
    });
    if (agent) {
      currentAgent = agent;
      agentConfig = {
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        toolNames: agent.tools as string[],
        maxSteps: agent.maxSteps,
        temperature: agent.temperature,
        isOrchestrator: agent.isOrchestrator,
      };
    }
  }

  const modelId = requestedModel || agentConfig?.model || "gpt-5.4-mini";

  // ---- 4. 获取 API Key ----
  //
  // 查找优先级：
  //   1. 精确匹配 provider（如 modelId=deepseek-chat → provider=deepseek → 查 provider="deepseek" 的 Key）
  //   2. 如果没找到，尝试查 provider="custom" 的 Key（用户可能把所有 Key 都配成 custom）
  //   3. 都没有，回退到环境变量
  //
  // 为什么要有 fallback 到 custom？
  // → Settings 页面 Provider 下拉框有 "Custom (OpenAI Compatible)" 选项
  // → 用户可能把 DeepSeek 的 Key 配在 custom 下面（因为 DeepSeek 本身就是 OpenAI 兼容格式）
  // → 如果只按 exact provider 查，就会 miss
  //
  // ★ 如果 modelId 不在预设注册表里（用户输入的自定义模型名），
  //   getProviderForModel 返回 null → 这里会 fallback 到 "openai"
  //   然后第二轮查 "custom" Key → 用户只要配了 custom Key 就能用任意模型名
  //
  const staticProviderId = getProviderForModel(modelId);
  let providerId = staticProviderId || "openai";
  let apiKey: string | null = null;
  let baseUrl: string | undefined;
  let keyFormat: string | undefined;   // ★ 用户 Key 上存的 API 格式

  let userKey: ApiKey | null = null;

  // 如果是自定义模型，反向扫描用户的所有激活 ApiKey 记录，看该模型挂载在哪个 Key 下
  if (!staticProviderId) {
    try {
      const activeKeys = await db.apiKey.findMany({
        where: { userId, isActive: true },
      });
      
      const matchedKey = activeKeys.find((k) => {
        const models = (k.models as unknown as ModelInfo[]) || [];
        return models.some((m) => m.id === modelId);
      });

      if (matchedKey) {
        userKey = matchedKey;
        providerId = matchedKey.provider; // 动态修正为所属的 providerId 关联
      }
    } catch (err) {
      console.error("[Chat API] Custom model provider scan failed:", err);
    }
  }

  // 如果动态没有匹配上，则退回到原有的静态双轮匹配
  if (!userKey) {
    // 第一轮：精确匹配 provider
    userKey = await db.apiKey.findFirst({
      where: { userId, provider: providerId, isActive: true },
    });

    // 第二轮：如果精确没匹配上，尝试 "custom"
    // （很多用户会把代理平台/第三方 API 都配成 custom）
    if (!userKey && providerId !== "custom") {
      userKey = await db.apiKey.findFirst({
        where: { userId, provider: "custom", isActive: true },
      });
    }
  }

  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey, userKey.iv);
    baseUrl = userKey.baseUrl || undefined;
    keyFormat = userKey.format || undefined;   // ★ 读取用户存储的 API 格式
  } else {
    // 第三轮：回退到环境变量
    const envKeyMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      google: process.env.GOOGLE_API_KEY,
    };
    apiKey = envKeyMap[providerId] || null;
  }

  if (!apiKey) {
    return Response.json(
      { error: `No API key found for provider "${providerId}". Add one in Settings → API Keys.` },
      { status: 400 }
    );
  }

  // ---- 5. 获取或创建对话 ----
  let conversationId = existingConvId;
  let isNewConversation = false;

  if (conversationId) {
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      isNewConversation = true;
    }
  } else {
    isNewConversation = true;
  }

  if (isNewConversation) {
    let defaultProject = await db.project.findFirst({
      where: { userId, name: "Default" },
    });
    if (!defaultProject) {
      defaultProject = await db.project.create({
        data: { userId, name: "Default", description: "Default project", defaultModel: modelId },
      });
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const titleText = lastUserMsg ? extractTextFromParts(lastUserMsg.parts) : "New Chat";
    const title = titleText.slice(0, 50) + (titleText.length > 50 ? "..." : "");

    const conversation = await db.conversation.create({
      data: {
        id: conversationId || undefined, // ★ 允许直接指定前端生成的唯一主键 ID
        projectId: defaultProject.id,
        title,
        agentId: agentId || undefined,
      },
    });
    conversationId = conversation.id;
  }

  if (!conversationId) {
    return Response.json({ error: "Conversation could not be initialized" }, { status: 500 });
  }
  const activeConversationId = conversationId;

  // ---- 6. 存用户消息 ----
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUserMessage ? extractTextFromParts(lastUserMessage.parts) : "";

  if (lastUserMessage) {
    const anyParts = (lastUserMessage.parts || []) as unknown as { type: string; mediaType?: string }[];
    const hasImage = anyParts.some((p) => p && p.type === "file" && p.mediaType?.startsWith("image/"));
    let contentToStore = userText;
    if (hasImage) {
      contentToStore = JSON.stringify({
        __isMultimodal: true,
        parts: lastUserMessage.parts,
      });
    }

    await db.message.create({
      data: { conversationId: activeConversationId, role: "user", content: contentToStore },
    });
  }

  // ---- 7. ★ Day 6: 检索 Memory + RAG，注入到系统提示词 ----
  //
  // 这是 Day 6 最关键的集成点！
  //
  // 原来的系统提示词只有 Agent 的角色定义。
  // 现在我们在角色定义后面追加两部分内容：
  //   (a) 相关记忆 — 来自 Memory 表的向量搜索结果
  //   (b) 相关文档 — 来自 KnowledgeBase 的 RAG 检索结果
  //
  // 这些内容对 LLM 来说就像"背景资料"，
  // LLM 在回答时会参考这些信息。
  //
  let systemPromptSuffix = "";

  // (a) 搜索相关记忆
  if (userText) {
    try {
      const memories = await searchRelevantMemories(userText, userId, { 
        limit: 5,
        conversationId: conversationId || undefined
      });
      systemPromptSuffix += formatMemoriesForPrompt(memories);
    } catch (err) {
      console.error("[Chat] Memory retrieval failed:", err);
    }
  }

  // (b) RAG 检索：如果指定了知识库
  if (knowledgeBaseId && userText) {
    try {
      const chunks = await retrieveRelevantChunks(
        userText,
        knowledgeBaseId,
        userId,
        { limit: 5 }
      );
      systemPromptSuffix += formatChunksForPrompt(chunks);
    } catch (err) {
      console.error("[Chat] RAG retrieval failed:", err);
    }
  }

  // 拼接最终系统提示词
  // ★ Day 6 简化：
  // 不在这里拼接 suffix，而是把 suffix 传给 Agent Engine，
  // 让 Engine 统一处理系统提示词的拼装。
  // 这里只负责确定"基础系统提示词"是什么。
  const defaultSystemPrompt = "你是一个智能个人助理。当你从对话中发现关于用户的偏好、偏恶、职业背景、交互行为习惯或常用工作流等高价值长期信息时，你应当主动调用 `memory_save` 工具将此条信息沉淀为长期记忆。而在回答时，系统已自动把相关的长期记忆作为小抄拼入你的上下文，你应尽量参考这些记忆来表达对用户的熟悉感与拟人化偏好。";
  const baseSystemPrompt = agentConfig?.systemPrompt || defaultSystemPrompt;

  // ---- 8. 创建模型实例 ----
  // ★ keyFormat 优先（用户在 Settings 里选的格式）
  // → 如果用户没指定 format，createModel() 内部会根据 providerId 自动判断
  const model = createModel(modelId, apiKey, {
    baseUrl,
    providerId,
    format: keyFormat as ApiFormat | undefined,
  });
  const cleanMessages = messages.filter((message) => {
    if (message.role !== "assistant") return true;
    return extractTextFromParts(message.parts).trim().length > 0;
  });
  const modelMessages = await convertToModelMessages(cleanMessages);

  // ---- 9. 使用 Agent Engine 创建流式响应 ----
  const defaultTools = ["memory_save", "memory_search"];
  const finalToolNames = enableTools
    ? (agentConfig?.toolNames ?? toolNames ?? defaultTools)
    : [];

  // ---- 9.1 加载子智能体列表（若为编排器模式） ----
  const subAgents: SubAgentInfo[] = [];
  if (agentConfig?.isOrchestrator && currentAgent) {
    try {
      const dbSubAgents = await db.agent.findMany({
        where: {
          projectId: currentAgent.projectId,
          id: { not: currentAgent.id },
        },
      });

      for (const sub of dbSubAgents) {
        try {
          const subModel = await getModelInstanceForUser(userId, sub.model);
          subAgents.push({
            name: sub.name,
            description: sub.description || "",
            systemPrompt: sub.systemPrompt,
            model: subModel,
            toolNames: sub.tools as string[],
            maxSteps: sub.maxSteps,
          });
        } catch (err) {
          console.error(`[Chat API] Failed to initialize sub-agent ${sub.name}:`, err);
        }
      }
    } catch (err) {
      console.error("[Chat API] Failed to query sub-agents:", err);
    }
  }

  const result = createAgentStream(
    {
      model,
      // ★ Day 6 简化：传基础 prompt + suffix，Engine 内部拼接
      systemPrompt: baseSystemPrompt,
      maxSteps: agentConfig?.maxSteps ?? 10,
      toolNames: finalToolNames,
      context: {
        userId,
        conversationId: activeConversationId,
      },
      subAgents: subAgents.length > 0 ? subAgents : undefined,
      // ★ Day 6: 传入 memory/RAG suffix 供 engine追加到系统提示词
      _systemPromptSuffix: systemPromptSuffix || undefined,
    },
    {
      messages: modelMessages,
    }
  );

  // ---- 10. 返回 SSE 流，并在流结束时保存助手消息 ----
  return result.toUIMessageStreamResponse({
    headers: { "X-Conversation-Id": activeConversationId },
    originalMessages: cleanMessages,
    onFinish: async ({ responseMessage }) => {
      try {
        const text = extractTextFromParts(responseMessage.parts);
        const totalUsage = await result.totalUsage;

        if (text.trim()) {
          await db.message.create({
            data: {
              conversationId: activeConversationId,
              role: "assistant",
              content: text,
              model: modelId,
              tokenCount: totalUsage?.totalTokens ?? 0,
            },
          });
        } else {
          console.warn("[Chat API] Assistant response was empty; skipping message persistence.", {
            conversationId: activeConversationId,
            modelId,
          });
        }

        await db.conversation.update({
          where: { id: activeConversationId },
          data: {
            updatedAt: new Date(),
            // ★ 同步更新 agentId，确保切换 Agent 后下次打开对话能恢复
            agentId: agentId || null,
          },
        });

        if (totalUsage) {
          const cost = calculateCost(
            modelId,
            totalUsage.inputTokens ?? 0,
            totalUsage.outputTokens ?? 0
          );
          await db.usageLog.create({
            data: {
              userId,
              model: modelId,
              provider: providerId,
              promptTokens: totalUsage.inputTokens ?? 0,
              completionTokens: totalUsage.outputTokens ?? 0,
              totalTokens: totalUsage.totalTokens ?? 0,
              cost,
            },
          });
        }
      } catch (err) {
        console.error("[Chat API] Failed to save response:", err);
      }
    },
  });
}

function extractTextFromParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

async function getModelInstanceForUser(userId: string, modelId: string) {
  const staticProviderId = getProviderForModel(modelId);
  let providerId = staticProviderId || "openai";
  let apiKey: string | null = null;
  let baseUrl: string | undefined;
  let keyFormat: string | undefined;

  let userKey: ApiKey | null = null;

  if (!staticProviderId) {
    try {
      const activeKeys = await db.apiKey.findMany({
        where: { userId, isActive: true },
      });
      const matchedKey = activeKeys.find((k) => {
        const models = (k.models as unknown as ModelInfo[]) || [];
        return models.some((m) => m.id === modelId);
      });

      if (matchedKey) {
        userKey = matchedKey;
        providerId = matchedKey.provider;
      }
    } catch (err) {
      console.error("[SubAgent Key scan fail]:", err);
    }
  }

  if (!userKey) {
    userKey = await db.apiKey.findFirst({
      where: { userId, provider: providerId, isActive: true },
    });

    if (!userKey && providerId !== "custom") {
      userKey = await db.apiKey.findFirst({
        where: { userId, provider: "custom", isActive: true },
      });
    }
  }

  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey, userKey.iv);
    baseUrl = userKey.baseUrl || undefined;
    keyFormat = userKey.format || undefined;
  } else {
    const envKeyMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      google: process.env.GOOGLE_API_KEY,
    };
    apiKey = envKeyMap[providerId] || null;
  }

  if (!apiKey) {
    throw new Error(`No API key found for model "${modelId}".`);
  }

  return createModel(modelId, apiKey, {
    baseUrl,
    providerId,
    format: keyFormat as ApiFormat | undefined,
  });
}
