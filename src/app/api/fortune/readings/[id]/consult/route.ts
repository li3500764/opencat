import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { createFortuneApiErrorResponse } from "@/lib/fortune/api-errors";
import {
  estimateTokens,
  generateFortuneConsultAnswer,
  selectMessagesForConsultCompression,
  selectRecentConsultMessages,
  shouldCompressConsultHistory,
  summarizeFortuneConsultHistory,
  type FortuneConsultMessageForPrompt,
} from "@/lib/fortune/consult";
import { getStoredFortuneMethod } from "@/lib/fortune/method";
import { FortuneInterpretationTimeoutError } from "@/lib/fortune/reader";
import { db } from "@/server/db";

const consultRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  modelId: z.string().trim().min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const reading = await db.fortuneReading.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!reading) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const consultSession = await db.fortuneConsultSession.findUnique({
      where: { readingId_userId: { readingId: id, userId: session.user.id } },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return Response.json({
      sessionId: consultSession?.id || null,
      summary: consultSession?.summary || "",
      messages:
        consultSession?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          model: message.model,
          createdAt: message.createdAt,
        })) || [],
    });
  } catch (error) {
    return createFortuneApiErrorResponse(error, {
      fallbackMessage: "Failed to load fortune consultation",
      fallbackCode: "FORTUNE_CONSULT_LOAD_FAILED",
      logLabel: "[fortune.consult.GET]",
    });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = consultRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id } = await params;
    const reading = await db.fortuneReading.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!reading) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const consultSession = await db.fortuneConsultSession.upsert({
      where: { readingId_userId: { readingId: reading.id, userId: session.user.id } },
      create: {
        readingId: reading.id,
        userId: session.user.id,
      },
      update: {},
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const recentMessages = selectRecentConsultMessages(consultSession.messages).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })) satisfies FortuneConsultMessageForPrompt[];

    const method = getStoredFortuneMethod(reading.chart);
    const answer = await generateFortuneConsultAnswer({
      userId: session.user.id,
      modelId: parsed.data.modelId,
      method,
      chart: reading.chart,
      initialInterpretation: reading.interpretation,
      summary: consultSession.summary,
      recentMessages,
      question: parsed.data.message,
    });

    const userTokenCount = estimateTokens(parsed.data.message);
    const [userMessage, assistantMessage] = await db.$transaction([
      db.fortuneConsultMessage.create({
        data: {
          sessionId: consultSession.id,
          role: "user",
          content: parsed.data.message,
          tokenCount: userTokenCount,
        },
      }),
      db.fortuneConsultMessage.create({
        data: {
          sessionId: consultSession.id,
          role: "assistant",
          content: answer.text,
          model: answer.modelId,
          tokenCount: answer.completionTokens,
        },
      }),
      db.fortuneConsultSession.update({
        where: { id: consultSession.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    if (answer.totalTokens > 0) {
      await db.usageLog.create({
        data: {
          userId: session.user.id,
          model: answer.modelId,
          provider: answer.providerId,
          promptTokens: answer.promptTokens,
          completionTokens: answer.completionTokens,
          totalTokens: answer.totalTokens,
          cost: answer.cost,
        },
      });
    }

    const allMessages = [
      ...consultSession.messages,
      userMessage,
      assistantMessage,
    ];
    if (shouldCompressConsultHistory(allMessages)) {
      const messagesToCompress = selectMessagesForConsultCompression(allMessages);
      const summary = await summarizeFortuneConsultHistory({
        userId: session.user.id,
        modelId: answer.modelId,
        previousSummary: consultSession.summary,
        messages: messagesToCompress.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      });
      await db.fortuneConsultSession.update({
        where: { id: consultSession.id },
        data: {
          summary,
          summaryTokens: estimateTokens(summary),
        },
      });
    }

    return Response.json({
      sessionId: consultSession.id,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        model: assistantMessage.model,
        createdAt: assistantMessage.createdAt,
      },
      usage: {
        promptTokens: answer.promptTokens,
        completionTokens: answer.completionTokens,
        totalTokens: answer.totalTokens,
        cost: answer.cost,
      },
    });
  } catch (error) {
    if (error instanceof FortuneInterpretationTimeoutError) {
      return Response.json(
        { error: "大师响应超时，请换用更快的模型或稍后重试", code: "FORTUNE_CONSULT_TIMEOUT" },
        { status: 504 }
      );
    }
    return createFortuneApiErrorResponse(error, {
      fallbackMessage: "Failed to ask fortune master",
      fallbackCode: "FORTUNE_CONSULT_FAILED",
      logLabel: "[fortune.consult.POST]",
    });
  }
}
