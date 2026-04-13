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
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ProviderInfo, ModelInfo, ApiFormat } from "./types";

// ============================================================
// 静态 Provider 注册表
// ============================================================
//
// 每个 Provider 必须声明 format（API 协议格式）：
//   - openai:           走 /chat/completions，适用于 DeepSeek、代理平台等
//   - openai-responses: 走 /responses，只有 OpenAI 官方支持
//   - anthropic:        走 /messages，Claude 系列
//   - google-genai:     走 Google Generative AI，Gemini 系列
//
export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    format: "openai-responses",   // OpenAI 官方走 Responses API（AI SDK 6.x 默认）
    models: [
      { id: "gpt-5.4",       name: "GPT-5.4",         provider: "openai", inputPrice: 2.5,   outputPrice: 15 },
      { id: "gpt-5.4-mini",  name: "GPT-5.4 Mini",    provider: "openai", inputPrice: 0.75,  outputPrice: 4.5 },
      { id: "gpt-5.4-nano",  name: "GPT-5.4 Nano",    provider: "openai", inputPrice: 0.2,   outputPrice: 1.25 },
      { id: "gpt-4.1",       name: "GPT-4.1",         provider: "openai", inputPrice: 2,     outputPrice: 8 },
      { id: "gpt-4.1-mini",  name: "GPT-4.1 Mini",    provider: "openai", inputPrice: 0.4,   outputPrice: 1.6 },
      { id: "gpt-4.1-nano",  name: "GPT-4.1 Nano",    provider: "openai", inputPrice: 0.1,   outputPrice: 0.4 },
      { id: "gpt-4o",        name: "GPT-4o (Legacy)",  provider: "openai", inputPrice: 2.5,   outputPrice: 10 },
      { id: "gpt-4o-mini",   name: "GPT-4o Mini (Legacy)", provider: "openai", inputPrice: 0.15, outputPrice: 0.6 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    format: "anthropic",
    models: [
      { id: "claude-opus-4-20250514",    name: "Claude Opus 4",     provider: "anthropic", inputPrice: 15,  outputPrice: 75 },
      { id: "claude-sonnet-4-20250514",  name: "Claude Sonnet 4",   provider: "anthropic", inputPrice: 3,   outputPrice: 15 },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku",  provider: "anthropic", inputPrice: 0.8, outputPrice: 4 },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    format: "openai",             // DeepSeek 兼容 OpenAI Chat Completions 格式
    defaultBaseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-chat",     name: "DeepSeek V3",     provider: "deepseek", inputPrice: 0.27, outputPrice: 1.1 },
      { id: "deepseek-reasoner", name: "DeepSeek R1",     provider: "deepseek", inputPrice: 0.55, outputPrice: 2.19 },
    ],
  },
  {
    id: "google",
    name: "Google",
    format: "google-genai",
    models: [
      { id: "gemini-3.1-pro-preview",  name: "Gemini 3.1 Pro",   provider: "google", inputPrice: 2.5,  outputPrice: 15 },
      { id: "gemini-3-flash",          name: "Gemini 3 Flash",   provider: "google", inputPrice: 0.15, outputPrice: 0.6 },
      { id: "gemini-2.5-flash",        name: "Gemini 2.5 Flash", provider: "google", inputPrice: 0.15, outputPrice: 0.6 },
      { id: "gemini-2.5-pro",          name: "Gemini 2.5 Pro",   provider: "google", inputPrice: 1.25, outputPrice: 10 },
    ],
  },
];

// ---- 快捷查询 ----
// 所有模型的扁平列表
export const ALL_MODELS: ModelInfo[] = PROVIDERS.flatMap((p) => p.models);

// 通过 modelId 找到对应的 provider ID
export function getProviderForModel(modelId: string): string | null {
  const model = ALL_MODELS.find((m) => m.id === modelId);
  return model?.provider ?? null;
}

// 通过 provider ID 找到 ProviderInfo（含 format）
export function getProviderInfo(providerId: string): ProviderInfo | null {
  return PROVIDERS.find((p) => p.id === providerId) ?? null;
}

// 通过 modelId 找到 ModelInfo
export function getModelInfo(modelId: string): ModelInfo | null {
  return ALL_MODELS.find((m) => m.id === modelId) ?? null;
}

// ============================================================
// 动态创建 LanguageModel 实例
// ============================================================
//
// ★ 核心原则：根据 format（API 协议格式）选择创建方式
//
//   format = "openai"           → createOpenAI().chat(modelId)
//                                  走 /chat/completions，兼容 DeepSeek、代理平台等
//
//   format = "openai-responses" → createOpenAI()(modelId)
//                                  走 /responses，只有 OpenAI 官方支持
//                                  但如果用户配了自定义 baseUrl（代理），降级走 .chat()
//
//   format = "anthropic"        → createAnthropic()(modelId)
//                                  走 /messages
//
//   format = "google-genai"     → createGoogleGenerativeAI()(modelId)
//                                  走 Google Generative AI
//
export function createModel(
  modelId: string,
  apiKey: string,
  options?: {
    baseUrl?: string;      // 自定义 API 地址
    providerId?: string;   // 强制指定 provider
    format?: ApiFormat;    // ★ 强制指定格式（用于 custom provider）
  }
): LanguageModel {
  const providerId = options?.providerId ?? getProviderForModel(modelId);
  const providerInfo = providerId ? getProviderInfo(providerId) : null;

  // 确定 API 格式：优先 options.format → 然后 providerInfo.format → 默认 openai
  const format: ApiFormat = options?.format ?? providerInfo?.format ?? "openai";

  // 确定 baseUrl：优先 options.baseUrl → 然后 providerInfo.defaultBaseUrl
  const baseUrl = options?.baseUrl ?? providerInfo?.defaultBaseUrl;

  switch (format) {
    case "openai": {
      // OpenAI Chat Completions 兼容格式 — 用 .chat() 走 /chat/completions
      const client = createOpenAI({ apiKey, baseURL: baseUrl });
      return client.chat(modelId);
    }

    case "openai-responses": {
      // OpenAI Responses API — 直接调用走 /responses
      // 但如果用户配了自定义 baseUrl（代理平台），降级走 .chat()
      // 因为代理平台基本都不支持 Responses API
      const client = createOpenAI({ apiKey, baseURL: baseUrl });
      if (baseUrl) {
        return client.chat(modelId);
      }
      return client(modelId);
    }

    case "anthropic": {
      const client = createAnthropic({ apiKey, baseURL: baseUrl });
      return client(modelId);
    }

    case "google-genai": {
      const client = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl });
      return client(modelId);
    }

    default:
      throw new Error(`Unknown API format: ${format} for model: ${modelId}`);
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
