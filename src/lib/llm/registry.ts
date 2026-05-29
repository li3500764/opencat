// ============================================================
// LLM Provider 动态工厂
// ============================================================
// 核心职责：
// 1. createModel()  — 根据协议格式动态创建 AI SDK 的 LanguageModel 实例
// 2. calculateCost() — 根据 token 用量和单价计算费用
//
// 不再维护静态 Provider 注册表，所有 Provider 和模型信息
// 都来自用户在 Settings 中的配置（数据库 ApiKey 表）

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ApiFormat } from "./types";

// ============================================================
// 根据协议格式创建 AI SDK LanguageModel 实例
// ============================================================
//
// 不再依赖静态注册表，完全动态：
//   format + apiKey + baseUrl → LanguageModel
//
// 各协议格式的创建方式：
//   openai           → createOpenAI().chat(modelId)   走 /chat/completions
//   openai-responses → createOpenAI()(modelId)        走 /responses（有 baseUrl 时降级走 .chat()）
//   anthropic        → createAnthropic()(modelId)     走 /messages
//   google-genai     → createGoogleGenerativeAI()(modelId)
//
export function createModel(
  modelId: string,
  apiKey: string,
  format: ApiFormat,
  baseUrl?: string,
): LanguageModel {
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
      throw new Error(`未知的 API 协议格式: ${format}，模型: ${modelId}`);
  }
}

// ============================================================
// 计算本次调用费用
// ============================================================
// price 单位：美元/百万 tokens
// 不再从静态注册表查价格，由调用方传入（来自用户配置的模型信息）
//
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputPrice: number,
  outputPrice: number,
): number {
  return (
    (inputTokens / 1_000_000) * inputPrice +
    (outputTokens / 1_000_000) * outputPrice
  );
}
