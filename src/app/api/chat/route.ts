// ============================================================
// Chat API — SSE 流式对话（AI SDK 6.x）
// ============================================================
// AI SDK 6.x 破坏性变更：
// 1. 客户端发的是 UIMessage[]（有 parts 数组），不是简单的 { role, content }
// 2. 需要 convertToModelMessages() 转成 LLM 能理解的格式
// 3. 返回用 toUIMessageStreamResponse() 而不是 toDataStreamResponse()
// 4. Usage 字段是 inputTokens/outputTokens（不是 promptTokens/completionTokens）

import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function POST(req: Request) {
  // ---- 1. 鉴权 ----
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // ---- 2. 解析请求体 ----
  // DefaultChatTransport 发送格式：{ messages: UIMessage[], id, trigger, ...body }
  const body = await req.json();
  const {
    messages,
    conversationId: existingConvId,
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    id?: string;       // chatId from transport
    trigger?: string;  // 'submit-message' | 'regenerate-message'
  };

  if (!messages?.length) {
    return new Response("Messages required", { status: 400 });
  }

  // ---- 3. 获取或创建对话 ----
  let conversationId = existingConvId;

  if (!conversationId) {
    // 确保用户有默认 Project
    let defaultProject = await db.project.findFirst({
      where: { userId, name: "Default" },
    });
    if (!defaultProject) {
      defaultProject = await db.project.create({
        data: {
          userId,
          name: "Default",
          description: "Default project",
          defaultModel: "gpt-4o",
        },
      });
    }

    // 从最后一条用户消息提取标题
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const titleText = lastUserMsg
      ? extractTextFromParts(lastUserMsg.parts)
      : "New Chat";
    const title =
      titleText.slice(0, 50) + (titleText.length > 50 ? "..." : "");

    const conversation = await db.conversation.create({
      data: {
        projectId: defaultProject.id,
        title,
      },
    });
    conversationId = conversation.id;
  }

  // ---- 4. 存最新的用户消息 ----
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const text = extractTextFromParts(lastUserMessage.parts);
    await db.message.create({
      data: {
        conversationId,
        role: "user",
        content: text,
      },
    });
  }

  // ---- 5. 转换消息格式，调 LLM ----
  // UIMessage（前端格式）→ ModelMessage（LLM 格式）
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      // ---- 6. 存 assistant 消息 ----
      await db.message.create({
        data: {
          conversationId: conversationId!,
          role: "assistant",
          content: text,
          model: "gpt-4o",
          tokenCount: usage?.totalTokens ?? 0,
        },
      });

      // 更新对话 updatedAt
      await db.conversation.update({
        where: { id: conversationId! },
        data: { updatedAt: new Date() },
      });

      // 记录用量
      if (usage) {
        await db.usageLog.create({
          data: {
            userId,
            model: "gpt-4o",
            provider: "openai",
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
          },
        });
      }
    },
  });

  // ---- 7. 返回 UIMessage 流式响应 ----
  // toUIMessageStreamResponse 是 AI SDK 6.x 的标准返回方式
  // 把 conversationId 塞到 header 里，客户端通过自定义 fetch 读取
  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": conversationId,
    },
  });
}

// ---- 工具函数 ----
// 从 UIMessage.parts 里提取纯文本
function extractTextFromParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
