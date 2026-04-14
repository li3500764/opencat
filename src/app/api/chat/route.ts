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
import { decrypt } from "@/lib/crypto";
import { createModel, getProviderForModel, calculateCost, getProviderInfo, type ApiFormat } from "@/lib/llm";
import { createAgentStream } from "@/lib/agent";
import {
  searchRelevantMemories,
  formatMemoriesForPrompt,
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "@/lib/memory";

export async function POST(req: Request) {
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
  } | null = null;

  if (agentId) {
    const agent = await db.agent.findFirst({
      where: { id: agentId, project: { userId } },
    });
    if (agent) {
      agentConfig = {
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        toolNames: agent.tools as string[],
        maxSteps: agent.maxSteps,
        temperature: agent.temperature,
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
  const providerId = getProviderForModel(modelId) || "openai";
  let apiKey: string | null = null;
  let baseUrl: string | undefined;
  let keyFormat: string | undefined;   // ★ 用户 Key 上存的 API 格式

  // 第一轮：精确匹配 provider
  let userKey = await db.apiKey.findFirst({
    where: { userId, provider: providerId, isActive: true },
  });

  // 第二轮：如果精确没匹配上，尝试 "custom"
  // （很多用户会把代理平台/第三方 API 都配成 custom）
  if (!userKey && providerId !== "custom") {
    userKey = await db.apiKey.findFirst({
      where: { userId, provider: "custom", isActive: true },
    });
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

  if (!conversationId) {
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
        projectId: defaultProject.id,
        title,
        agentId: agentId || undefined,
      },
    });
    conversationId = conversation.id;
  }

  // ---- 6. 存用户消息 ----
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUserMessage ? extractTextFromParts(lastUserMessage.parts) : "";

  if (lastUserMessage) {
    await db.message.create({
      data: { conversationId, role: "user", content: userText },
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
      const memories = await searchRelevantMemories(userText, userId, { limit: 5 });
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
  const baseSystemPrompt = agentConfig?.systemPrompt || undefined;

  // ---- 8. 创建模型实例 ----
  // ★ keyFormat 优先（用户在 Settings 里选的格式）
  // → 如果用户没指定 format，createModel() 内部会根据 providerId 自动判断
  const model = createModel(modelId, apiKey, {
    baseUrl,
    providerId,
    format: keyFormat as ApiFormat | undefined,
  });
  const modelMessages = await convertToModelMessages(messages);

  // ---- 9. 使用 Agent Engine 创建流式响应 ----
  const finalToolNames = enableTools
    ? (agentConfig?.toolNames ?? toolNames)
    : [];

  const result = createAgentStream(
    {
      model,
      // ★ Day 6 简化：传基础 prompt + suffix，Engine 内部拼接
      systemPrompt: baseSystemPrompt,
      maxSteps: agentConfig?.maxSteps ?? 10,
      toolNames: finalToolNames,
      context: {
        userId,
        conversationId,
      },
      // ★ Day 6: 传入 memory/RAG suffix 供 engine 追加到系统提示词
      _systemPromptSuffix: systemPromptSuffix || undefined,
    },
    {
      messages: modelMessages,
    }
  );

  // ---- 10. 后台保存 ----
  void (async () => {
    try {
      const [text, totalUsage] = await Promise.all([
        result.text,
        result.totalUsage,
      ]);

      await db.message.create({
        data: {
          conversationId: conversationId!,
          role: "assistant",
          content: text,
          model: modelId,
          tokenCount: totalUsage?.totalTokens ?? 0,
        },
      });

      await db.conversation.update({
        where: { id: conversationId! },
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
  })();

  // ---- 11. 返回 SSE 流 ----
  return result.toUIMessageStreamResponse({
    headers: { "X-Conversation-Id": conversationId },
  });
}

function extractTextFromParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
