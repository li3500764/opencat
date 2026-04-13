// ============================================================
// LLM 类型定义
// ============================================================

// ---- API 协议格式 ----
//
// 不同的 LLM API 有不同的请求/响应协议，不能混用：
//
//   openai          — OpenAI Chat Completions 格式（POST /v1/chat/completions）
//                     绝大多数第三方兼容接口用的都是这个：DeepSeek、代理平台、one-api 等
//
//   openai-responses — OpenAI Responses API 格式（POST /v1/responses）
//                     AI SDK 6.x 默认走这个，但只有 OpenAI 官方支持
//                     功能更强（内置 web search、file search 等），但不兼容第三方
//
//   anthropic       — Anthropic Messages API 格式（POST /v1/messages）
//                     Claude 系列专用，请求体结构和 OpenAI 完全不同
//
//   google-genai    — Google Generative AI 格式
//                     Gemini 系列专用，@ai-sdk/google 封装
//
export type ApiFormat = "openai" | "openai-responses" | "anthropic" | "google-genai";

export interface ModelInfo {
  id: string;          // 模型 ID，如 "gpt-4o"
  name: string;        // 显示名，如 "GPT-4o"
  provider: string;    // 归属的 provider ID，如 "openai"
  inputPrice: number;  // 每百万 input tokens 美元价格
  outputPrice: number; // 每百万 output tokens 美元价格
}

export interface ProviderInfo {
  id: string;          // "openai" | "anthropic" | "deepseek" | "google" | "custom"
  name: string;        // "OpenAI" | "Anthropic" | "DeepSeek" | "Google"
  format: ApiFormat;   // ★ API 协议格式
  defaultBaseUrl?: string;  // 默认 API 地址（如 DeepSeek 的 https://api.deepseek.com）
  models: ModelInfo[];
}

// ---- API 格式的显示名映射（Settings 页面用） ----
export const API_FORMAT_LABELS: Record<ApiFormat, string> = {
  "openai":           "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses API",
  "anthropic":        "Anthropic Messages",
  "google-genai":     "Google Generative AI",
};
