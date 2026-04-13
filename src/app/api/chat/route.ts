// ============================================================
// Chat API — SSE 流式对话（Day 5: Agent 选择 + 项目隔离）
// ============================================================
//
// Day 5 升级：
// 1. 新增 agentId 参数 — 使用指定 Agent 的配置（系统提示词、工具、模型等）
// 2. Agent 配置覆盖机制：agentId → 加载 Agent → 用 Agent 的 systemPrompt + tools + model
// 3. 项目隔离：Conversation 关联 agentId
// 4. 兼容 Day 4：不传 agentId 时退化为默认 Agent 行为
//
// 请求体：
//   messages:       UIMessage[]      — 对话消息
//   conversationId: string?          — 已有对话 ID（续聊时传）
//   modelId:        string?          — 模型 ID（默认 gpt-4o）
//   agentId:        string?          — ★ Agent ID（Day 5 新增）
//   enableTools:    boolean?         — 是否启用工具（默认 true）
//   toolNames:      string[]?        — 指定工具列表
// ============================================================

import { convertToModelMessages, type UIMessage } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
import { createModel, getProviderForModel, calculateCost } from "@/lib/llm";
import { createAgentStream } from "@/lib/agent";

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
    agentId,                        // ★ Day 5 新增
    enableTools = true,
    toolNames,
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    modelId?: string;
    agentId?: string;               // ★ Day 5 新增
    enableTools?: boolean;
    toolNames?: string[];
    id?: string;
    trigger?: string;
  };

  if (!messages?.length) {
    return new Response("Messages required", { status: 400 });
  }

  // ---- 3. ★ Day 5: 加载 Agent 配置 ----
  //
  // 如果前端传了 agentId，从数据库加载这个 Agent 的完整配置：
  //   - systemPrompt（系统提示词 → 定义 Agent 角色）
  //   - model（使用的 LLM 模型）
  //   - tools（可调用的工具列表）
  //   - maxSteps（ReAct 最大步数）
  //   - temperature（创造性参数）
  //
  // 加载后，这些配置会覆盖默认值。
  // 前端的 modelId 仍可以手动覆盖 Agent 的默认模型。
  //
  let agentConfig: {
    systemPrompt?: string;
    model: string;
    toolNames: string[];
    maxSteps: number;
    temperature: number;
  } | null = null;

  if (agentId) {
    // 查找 Agent，同时校验项目属于当前用户（项目隔离）
    const agent = await db.agent.findFirst({
      where: {
        id: agentId,
        project: { userId },
      },
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
    // Agent 不存在时不报错，退化为默认行为
  }

  // ---- 4. 确定最终使用的模型 ----
  //
  // 优先级：前端 modelId > Agent 配置 > 默认 gpt-4o
  // 为什么前端优先？→ 用户可能想临时切换模型，不改变 Agent 配置
  const modelId = requestedModel || agentConfig?.model || "gpt-4o";

  // ---- 5. 获取 API Key ----
  const providerId = getProviderForModel(modelId) || "openai";
  let apiKey: string | null = null;
  let baseUrl: string | undefined;

  const userKey = await db.apiKey.findFirst({
    where: { userId, provider: providerId, isActive: true },
  });

  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey, userKey.iv);
    baseUrl = userKey.baseUrl || undefined;
  } else {
    const envKeyMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    };
    apiKey = envKeyMap[providerId] || null;
  }

  if (!apiKey) {
    return Response.json(
      { error: `No API key found for provider "${providerId}". Add one in Settings → API Keys.` },
      { status: 400 }
    );
  }

  // ---- 6. 获取或创建对话 ----
  let conversationId = existingConvId;

  if (!conversationId) {
    let defaultProject = await db.project.findFirst({
      where: { userId, name: "Default" },
    });
    if (!defaultProject) {
      defaultProject = await db.project.create({
        data: {
          userId,
          name: "Default",
          description: "Default project",
          defaultModel: modelId,
        },
      });
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const titleText = lastUserMsg ? extractTextFromParts(lastUserMsg.parts) : "New Chat";
    const title = titleText.slice(0, 50) + (titleText.length > 50 ? "..." : "");

    const conversation = await db.conversation.create({
      data: {
        projectId: defaultProject.id,
        title,
        // ★ Day 5: 关联 Agent
        agentId: agentId || undefined,
      },
    });
    conversationId = conversation.id;
  }

  // ---- 7. 存用户消息 ----
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const text = extractTextFromParts(lastUserMessage.parts);
    await db.message.create({
      data: { conversationId, role: "user", content: text },
    });
  }

  // ---- 8. 创建模型实例 ----
  const model = createModel(modelId, apiKey, { baseUrl, providerId });
  const modelMessages = await convertToModelMessages(messages);

  // ---- 9. 使用 Agent Engine 创建流式响应 ----
  //
  // ★ Day 5: Agent 配置覆盖
  //
  // 如果有 agentConfig（即选择了自定义 Agent），使用 Agent 的配置：
  //   - systemPrompt → Agent 的角色定义
  //   - toolNames → Agent 配置的工具列表
  //   - maxSteps → Agent 的最大步数
  //
  // 如果没有 agentConfig（默认模式），使用 Day 4 的默认行为：
  //   - 默认系统提示词
  //   - 所有内置工具
  //   - maxSteps = 10
  //
  const finalToolNames = enableTools
    ? (agentConfig?.toolNames ?? toolNames)
    : [];

  const result = createAgentStream(
    {
      model,
      systemPrompt: agentConfig?.systemPrompt,
      maxSteps: agentConfig?.maxSteps ?? 10,
      toolNames: finalToolNames,
      context: {
        userId,
        conversationId,
      },
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
        data: { updatedAt: new Date() },
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
