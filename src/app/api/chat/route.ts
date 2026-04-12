// ============================================================
// Chat API — SSE 流式对话（Day 3: 多模型 Gateway）
// ============================================================
// Day 3 升级：
// 1. 支持 modelId 参数，动态选择模型
// 2. 从用户的 ApiKey 表解密获取 Key（不再依赖 .env）
// 3. 回退：如果用户没配 Key，尝试用 .env 里的
// 4. 用 Provider 抽象层的 createModel() 创建模型实例

import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
import { createModel, getProviderForModel, calculateCost } from "@/lib/llm";

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
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    modelId?: string;
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

  // ---- 6. 创建模型实例，流式生成 ----
  const model = createModel(modelId, apiKey, { baseUrl, providerId });
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      // 存 assistant 消息
      await db.message.create({
        data: {
          conversationId: conversationId!,
          role: "assistant",
          content: text,
          model: modelId,
          tokenCount: usage?.totalTokens ?? 0,
        },
      });

      await db.conversation.update({
        where: { id: conversationId! },
        data: { updatedAt: new Date() },
      });

      // 记录用量 + 费用
      if (usage) {
        const cost = calculateCost(
          modelId,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0
        );
        await db.usageLog.create({
          data: {
            userId,
            model: modelId,
            provider: providerId,
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
            cost,
          },
        });
      }
    },
  });

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
