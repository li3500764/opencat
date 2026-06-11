import { generateText, type FinishReason, type LanguageModel } from "ai";

export interface CompleteFortuneTextResult {
  text: string;
  finishReason: FinishReason;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  continuationCount: number;
}

export interface CompleteFortuneTextOptions {
  model: LanguageModel;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  continuationMaxOutputTokens?: number;
  maxContinuations?: number;
  timeoutMs: number;
}

export function shouldContinueFortuneText(finishReason: FinishReason) {
  return finishReason === "length";
}

export function buildFortuneContinuationPrompt(input: {
  originalPrompt: string;
  currentText: string;
}) {
  return `${input.originalPrompt}

【已经生成但被长度限制截断的回答】
${input.currentText}

请从上文最后一句之后继续完成回答。不要重复已经说过的内容，不要重新开头，不要输出“继续”二字。`;
}

export async function generateCompleteFortuneText(
  options: CompleteFortuneTextOptions
): Promise<CompleteFortuneTextResult> {
  const continuationMaxOutputTokens = options.continuationMaxOutputTokens ?? options.maxOutputTokens;
  const maxContinuations = options.maxContinuations ?? 2;

  const first = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens,
    timeout: { totalMs: options.timeoutMs },
  });

  let text = first.text.trim();
  let finishReason = first.finishReason;
  let promptTokens = first.usage?.inputTokens ?? 0;
  let completionTokens = first.usage?.outputTokens ?? 0;
  let totalTokens = first.usage?.totalTokens ?? promptTokens + completionTokens;
  let continuationCount = 0;

  while (shouldContinueFortuneText(finishReason) && continuationCount < maxContinuations) {
    continuationCount += 1;
    const continuation = await generateText({
      model: options.model,
      system: options.system,
      prompt: buildFortuneContinuationPrompt({
        originalPrompt: options.prompt,
        currentText: text,
      }),
      maxOutputTokens: continuationMaxOutputTokens,
      timeout: { totalMs: options.timeoutMs },
    });

    text = joinFortuneText(text, continuation.text.trim());
    finishReason = continuation.finishReason;
    const continuationInputTokens = continuation.usage?.inputTokens ?? 0;
    const continuationOutputTokens = continuation.usage?.outputTokens ?? 0;
    promptTokens += continuationInputTokens;
    completionTokens += continuationOutputTokens;
    totalTokens += continuation.usage?.totalTokens ?? continuationInputTokens + continuationOutputTokens;
  }

  return {
    text,
    finishReason,
    promptTokens,
    completionTokens,
    totalTokens,
    continuationCount,
  };
}

function joinFortuneText(currentText: string, continuationText: string) {
  if (!continuationText) return currentText;
  if (!currentText) return continuationText;
  return `${currentText}\n${continuationText}`;
}
