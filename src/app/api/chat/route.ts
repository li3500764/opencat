// ============================================================
// Chat API — SSE 流式对话（Day 4: ReAct Agent + Tool Calling）
// ============================================================
//
// Day 4 升级内容：
// 1. 引入 Agent Engine，支持 Tool Calling（计算器、日期时间、HTTP 请求）
// 2. 前端可通过 enableTools 参数控制是否启用工具
// 3. streamText 增加 tools 和 stopWhen 参数，实现 ReAct 循环
// 4. onFinish 回调中记录工具调用信息
//
// 请求体新增字段：
//   enableTools?: boolean  — 是否启用 Agent 工具（默认 true）
//   toolNames?: string[]   — 指定启用哪些工具（不传 = 全部内置工具）
//
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
    // ★ Day 4 新增：工具相关参数
    enableTools = true,       // 默认启用工具
    toolNames,                // 可选：指定要用的工具列表
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    modelId?: string;
    enableTools?: boolean;
    toolNames?: string[];
    id?: string;
    trigger?: string;
  };

  if (!messages?.length) {
    return new Response("Messages required", { status: 400 });
  }

  const modelId = requestedModel || "gpt-4o";

  // ---- 3. 获取 API Key ----
  // 优先用用户存储的 Key，回退到环境变量
  const providerId = getProviderForModel(modelId) || "openai";
  let apiKey: string | null = null;
  let baseUrl: string | undefined;

  // 查用户的 Key
  const userKey = await db.apiKey.findFirst({
    where: { userId, provider: providerId, isActive: true },
  });

  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey, userKey.iv);
    baseUrl = userKey.baseUrl || undefined;
  } else {
    // 回退到 .env
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

  // ---- 4. 获取或创建对话 ----
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
      data: { projectId: defaultProject.id, title },
    });
    conversationId = conversation.id;
  }

  // ---- 5. 存用户消息 ----
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const text = extractTextFromParts(lastUserMessage.parts);
    await db.message.create({
      data: { conversationId, role: "user", content: text },
    });
  }

  // ---- 6. 创建模型实例 ----
  const model = createModel(modelId, apiKey, { baseUrl, providerId });
  const modelMessages = await convertToModelMessages(messages);

  // ---- 7. ★ Day 4 改造：使用 Agent Engine 创建流式响应 ----
  //
  // 之前（Day 2-3）直接调用 streamText：
  //   const result = streamText({ model, messages: modelMessages });
  //
  // 现在通过 Agent Engine 包装，增加了 tools 和 stopWhen：
  //   createAgentStream(config, options) 内部还是调 streamText，
  //   但额外传入了 tools（工具集）和 stopWhen: stepCountIs(10)
  //
  // 当 enableTools = false 时，不传工具 → 退化为普通聊天（兼容 Day 3）
  //
  const result = createAgentStream(
    {
      model,
      maxSteps: 10,
      // 如果前端指定不启用工具，传空数组 → 不会注入任何工具
      toolNames: enableTools ? toolNames : [],
      context: {
        userId,
        conversationId,
      },
    },
    {
      messages: modelMessages,
    }
  );

  // ---- 8. 后台保存 AI 回复 + 用量记录 ----
  //
  // StreamTextResult 的属性（.text, .totalUsage 等）都是 PromiseLike
  // 当流式传输完成后，这些 Promise 会 resolve
  //
  // 注意：这里用 void 开头是因为我们不 await 这个 Promise
  // 我们需要先返回 SSE 流给前端（第 9 步），让用户立即看到流式响应
  // 保存数据库的操作在后台异步完成，不阻塞响应
  //
  // 这叫做 "fire and forget" 模式：
  //   发射（启动异步任务）然后忘掉（不等它完成）
  //   用于不影响用户体验的后台任务
  void (async () => {
    try {
      // 等待流式生成完成，获取最终文本和用量
      const [text, totalUsage] = await Promise.all([
        result.text,       // 最终生成的完整文本
        result.totalUsage, // 所有步骤的总 token 用量（多步工具调用会累加）
      ]);

      // 存 assistant 消息到数据库
      await db.message.create({
        data: {
          conversationId: conversationId!,
          role: "assistant",
          content: text,
          model: modelId,
          tokenCount: totalUsage?.totalTokens ?? 0,
        },
      });

      // 更新对话的最后修改时间
      await db.conversation.update({
        where: { id: conversationId! },
        data: { updatedAt: new Date() },
      });

      // 记录用量 + 费用
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
      // 后台保存失败不应该影响用户，只打日志
      console.error("[Chat API] Failed to save response:", err);
    }
  })();

  // ---- 9. 返回 SSE 流 ----
  return result.toUIMessageStreamResponse({
    headers: { "X-Conversation-Id": conversationId },
  });
}

// ---------- 辅助函数 ----------
function extractTextFromParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
