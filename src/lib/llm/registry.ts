// ============================================================
// LLM Provider 注册表
// ============================================================
// 核心架构：
// 1. PROVIDERS 静态注册所有支持的 Provider 和模型
// 2. createModel() 根据 modelId 动态创建 AI SDK 的 LanguageModel 实例
// 3. 支持用户自定义 API Key 和 Base URL
//
// 面试关键点：
// - 不用 LangChain，自己写 Provider 抽象层
// - Provider 可插拔，新增一个 Provider 只需要加一条配置
// - 加密的 API Key 只在服务端解密，客户端永远看不到

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { ProviderInfo, ModelInfo } from "./types";

// ---- 静态 Provider 注册表 ----
export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o",       name: "GPT-4o",        provider: "openai", inputPrice: 2.5,  outputPrice: 10 },
      { id: "gpt-4o-mini",  name: "GPT-4o Mini",   provider: "openai", inputPrice: 0.15, outputPrice: 0.6 },
      { id: "gpt-4.1",      name: "GPT-4.1",       provider: "openai", inputPrice: 2,    outputPrice: 8 },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini",  provider: "openai", inputPrice: 0.4,  outputPrice: 1.6 },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano",  provider: "openai", inputPrice: 0.1,  outputPrice: 0.4 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514",    name: "Claude Sonnet 4",    provider: "anthropic", inputPrice: 3,  outputPrice: 15 },
      { id: "claude-3-5-haiku-20241022",   name: "Claude 3.5 Haiku",  provider: "anthropic", inputPrice: 0.8, outputPrice: 4 },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      { id: "deepseek-chat",     name: "DeepSeek V3",     provider: "deepseek", inputPrice: 0.27, outputPrice: 1.1 },
      { id: "deepseek-reasoner", name: "DeepSeek R1",     provider: "deepseek", inputPrice: 0.55, outputPrice: 2.19 },
    ],
  },
];

// ---- 快捷查询 ----
// 所有模型的扁平列表
export const ALL_MODELS: ModelInfo[] = PROVIDERS.flatMap((p) => p.models);

// 通过 modelId 找到对应的 provider
export function getProviderForModel(modelId: string): string | null {
  const model = ALL_MODELS.find((m) => m.id === modelId);
  return model?.provider ?? null;
}

// 通过 modelId 找到 ModelInfo
export function getModelInfo(modelId: string): ModelInfo | null {
  return ALL_MODELS.find((m) => m.id === modelId) ?? null;
}

// ---- 动态创建 LanguageModel 实例 ----
// 核心函数：根据 modelId + 用户的 API Key 创建 AI SDK 的模型对象
export function createModel(
  modelId: string,
  apiKey: string,
  options?: {
    baseUrl?: string;      // 自定义 API 地址（如 DeepSeek、heiyu 等代理）
    providerId?: string;   // 强制指定 provider（用于 custom provider）
  }
): LanguageModel {
  const providerId = options?.providerId ?? getProviderForModel(modelId);

  switch (providerId) {
    case "openai": {
      const openai = createOpenAI({
        apiKey,
        baseURL: options?.baseUrl,
      });
      return openai(modelId);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: options?.baseUrl,
      });
      return anthropic(modelId);
    }

    case "deepseek": {
      // DeepSeek 用 OpenAI 兼容接口
      const deepseek = createOpenAI({
        apiKey,
        baseURL: options?.baseUrl ?? "https://api.deepseek.com",
      });
      return deepseek(modelId);
    }

    case "custom": {
      // 自定义 Provider 走 OpenAI 兼容格式（大多数国内代理都兼容）
      if (!options?.baseUrl) {
        throw new Error("Custom provider requires a baseUrl");
      }
      const custom = createOpenAI({
        apiKey,
        baseURL: options.baseUrl,
      });
      return custom(modelId);
    }

    default:
      throw new Error(`Unknown provider: ${providerId} for model: ${modelId}`);
  }
}

// ---- 计算费用 ----
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelInfo(modelId);
  if (!model) return 0;
  return (
    (inputTokens / 1_000_000) * model.inputPrice +
    (outputTokens / 1_000_000) * model.outputPrice
  );
}
