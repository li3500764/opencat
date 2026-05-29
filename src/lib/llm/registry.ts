// ============================================================
// LLM Provider 注册表 (仅保留 OpenAI 兼容格式)
// ============================================================

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ProviderInfo, ModelInfo, ApiFormat } from "./types";

// ============================================================
// 静态 Provider 预设注册表（仅保留 OpenAI 兼容格式的内置推荐）
// ============================================================
export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    format: "openai",
    models: [
      { id: "gpt-4o",        name: "GPT-4o",          provider: "openai", inputPrice: 2.5,   outputPrice: 10 },
      { id: "gpt-4o-mini",   name: "GPT-4o Mini",     provider: "openai", inputPrice: 0.15,  outputPrice: 0.6 },
      { id: "deepseek-chat",     name: "DeepSeek V3",     provider: "openai", inputPrice: 0.27, outputPrice: 1.1 },
      { id: "deepseek-reasoner", name: "DeepSeek R1",     provider: "openai", inputPrice: 0.55, outputPrice: 2.19 },
    ],
  }
];

// 所有默认模型的扁平列表
export const ALL_MODELS: ModelInfo[] = PROVIDERS.flatMap((p) => p.models);

// 通过 modelId 找到对应的 provider ID
export function getProviderForModel(modelId: string): string | null {
  const model = ALL_MODELS.find((m) => m.id === modelId);
  return model?.provider ?? null;
}

// 通过 provider ID 找到 ProviderInfo
export function getProviderInfo(providerId: string): ProviderInfo | null {
  return PROVIDERS.find((p) => p.id === providerId) ?? null;
}

// 通过 modelId 找到 ModelInfo
export function getModelInfo(modelId: string): ModelInfo | null {
  return ALL_MODELS.find((m) => m.id === modelId) ?? null;
}

// ============================================================
// 仅支持 OpenAI 兼容格式的通用模型创建工厂
// ============================================================
export function createModel(
  modelId: string,
  apiKey: string,
  optionsOrFormat?: ApiFormat | {
    baseUrl?: string;
    providerId?: string;
    format?: ApiFormat;
  },
  maybeBaseUrl?: string
): LanguageModel {
  let baseUrl: string | undefined;

  // 1. 如果第三个参数是 string (代表 format / url)
  if (typeof optionsOrFormat === "string") {
    // 兼容可能传入 baseurl 的老旧代码
    if (optionsOrFormat.startsWith("http")) {
      baseUrl = optionsOrFormat;
    } else {
      baseUrl = maybeBaseUrl;
    }
  }
  // 2. 如果第三个参数是 options 对象
  else if (optionsOrFormat) {
    baseUrl = optionsOrFormat.baseUrl;
  }

  // 统一通过 @ai-sdk/openai 构建 OpenAI 兼容模型实例
  const client = createOpenAI({ apiKey, baseURL: baseUrl });
  return client.chat(modelId);
}

// ============================================================
// 计算费用 (支持 inputPrice / outputPrice 动态计费与默认计费)
// ============================================================
export function calculateCost(
  modelIdOrInputTokens: string | number,
  inputTokensOrOutputTokens: number,
  outputTokensOrInputPrice?: number,
  outputPrice?: number,
): number {
  if (typeof modelIdOrInputTokens === "string") {
    const model = getModelInfo(modelIdOrInputTokens);
    if (!model) return 0;
    return (
      (inputTokensOrOutputTokens / 1_000_000) * model.inputPrice +
      ((outputTokensOrInputPrice ?? 0) / 1_000_000) * model.outputPrice
    );
  } else {
    const inputTokens = modelIdOrInputTokens;
    const outputTokens = inputTokensOrOutputTokens;
    const inputPrice = outputTokensOrInputPrice ?? 0;
    const outPrice = outputPrice ?? 0;
    return (
      (inputTokens / 1_000_000) * inputPrice +
      (outputTokens / 1_000_000) * outPrice
    );
  }
}

