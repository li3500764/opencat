import { generateText } from "ai";
import { calculateCost, createModel } from "../llm";
import { getFortuneMethodName } from "./method";
import { FortuneInterpretationTimeoutError, resolveFortuneModelConfig } from "./reader";
import type { FortuneMethod } from "./types";

export const CONSULT_RECENT_MESSAGE_LIMIT = 8;
export const CONSULT_COMPRESSION_MESSAGE_THRESHOLD = 20;
export const CONSULT_COMPRESSION_TOKEN_THRESHOLD = 6000;

export type FortuneConsultRole = "user" | "assistant";

export interface FortuneConsultMessageForPrompt {
  role: FortuneConsultRole;
  content: string;
}

export interface FortuneConsultGenerationResult {
  text: string;
  modelId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 2);
}

export function shouldCompressConsultHistory(messages: { tokenCount: number }[]) {
  const totalTokens = messages.reduce((sum, message) => sum + message.tokenCount, 0);
  return messages.length > CONSULT_COMPRESSION_MESSAGE_THRESHOLD || totalTokens > CONSULT_COMPRESSION_TOKEN_THRESHOLD;
}

export function selectRecentConsultMessages<T>(messages: T[]) {
  return messages.slice(-CONSULT_RECENT_MESSAGE_LIMIT);
}

export function selectMessagesForConsultCompression<T>(messages: T[]) {
  return messages.slice(0, Math.max(0, messages.length - CONSULT_RECENT_MESSAGE_LIMIT));
}

export function buildFortuneConsultSystemPrompt(method: FortuneMethod) {
  return `你是 OpenCat 的${getFortuneMethodName(method)}咨询大师。你必须遵守：
1. 只能基于当前 method 和程序生成的 chart JSON 回答。
2. 不得重新排盘、起卦或抽牌，不得修改 chart 字段。
3. 不得跨体系混合解读；当前是${getFortuneMethodName(method)}，只能使用这个体系。
4. 不得声称绝对准确，不得提供医疗、法律、投资、婚恋等重大决策指令。
5. 回答要针对用户问题，引用盘面字段作为依据，语气克制具体。`;
}

export function buildFortuneConsultPrompt(input: {
  method: FortuneMethod;
  chart: unknown;
  initialInterpretation: string;
  summary?: string | null;
  recentMessages: FortuneConsultMessageForPrompt[];
  question: string;
}) {
  const recent = input.recentMessages
    .map((message) => `${message.role === "user" ? "用户" : "大师"}：${message.content}`)
    .join("\n\n");

  return `【当前测算方法】
${getFortuneMethodName(input.method)}

【程序盘面 JSON】
${JSON.stringify(input.chart, null, 2)}

【首次 AI 解读】
${input.initialInterpretation || "无"}

【历史咨询摘要】
${input.summary?.trim() || "暂无"}

【最近对话】
${recent || "暂无"}

【用户最新问题】
${input.question}

请直接回答用户最新问题。`;
}

export function buildFortuneConsultSummaryPrompt(input: {
  previousSummary?: string | null;
  messages: FortuneConsultMessageForPrompt[];
}) {
  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "用户" : "大师"}：${message.content}`)
    .join("\n\n");

  return `请把以下命盘咨询对话压缩成后续继续咨询可用的摘要。
只保留：用户关心的问题、已经给过的重要判断、用户补充的事实、已明确说明的限制或口径。
不要新增判断，不要扩写，不要跨体系。

【已有摘要】
${input.previousSummary?.trim() || "无"}

【待压缩对话】
${transcript}

请输出 500 字以内的中文摘要。`;
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase().includes("abort") ||
      error.message.toLowerCase().includes("timeout"))
  );
}

export async function generateFortuneConsultAnswer(input: {
  userId: string;
  modelId: string;
  method: FortuneMethod;
  chart: unknown;
  initialInterpretation: string;
  summary?: string | null;
  recentMessages: FortuneConsultMessageForPrompt[];
  question: string;
}): Promise<FortuneConsultGenerationResult> {
  const config = await resolveFortuneModelConfig(input.userId, input.modelId);
  const model = createModel(config.modelId, config.apiKey, {
    baseUrl: config.baseUrl,
    providerId: config.providerId,
    format: config.format,
  });

  try {
    const result = await generateText({
      model,
      system: buildFortuneConsultSystemPrompt(input.method),
      prompt: buildFortuneConsultPrompt(input),
      maxOutputTokens: 1400,
      timeout: { totalMs: 80_000 },
    });
    const promptTokens = result.usage?.inputTokens ?? estimateTokens(buildFortuneConsultPrompt(input));
    const completionTokens = result.usage?.outputTokens ?? estimateTokens(result.text);
    const totalTokens = result.usage?.totalTokens ?? promptTokens + completionTokens;
    return {
      text: result.text.trim(),
      modelId: config.modelId,
      providerId: config.providerId,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: calculateCost(config.modelId, promptTokens, completionTokens),
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new FortuneInterpretationTimeoutError();
    }
    throw error;
  }
}

export async function summarizeFortuneConsultHistory(input: {
  userId: string;
  modelId: string;
  previousSummary?: string | null;
  messages: FortuneConsultMessageForPrompt[];
}) {
  if (input.messages.length === 0) return input.previousSummary || "";
  const config = await resolveFortuneModelConfig(input.userId, input.modelId);
  const model = createModel(config.modelId, config.apiKey, {
    baseUrl: config.baseUrl,
    providerId: config.providerId,
    format: config.format,
  });
  try {
    const result = await generateText({
      model,
      system: "你负责压缩命盘咨询对话记忆，只做摘要，不做新解读。",
      prompt: buildFortuneConsultSummaryPrompt(input),
      maxOutputTokens: 700,
      timeout: { totalMs: 45_000 },
    });
    return result.text.trim();
  } catch (error) {
    console.error("[fortune.consult.summary] failed", error);
    return input.previousSummary || "";
  }
}
