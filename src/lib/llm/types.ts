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

// ---- 模型信息 ----
// 单个模型的配置信息（可选包含 provider，以向后兼容）
export interface ModelInfo {
  id: string;          // 模型 ID，如 "gpt-4o"
  name: string;        // 显示名，如 "GPT-4o"
  provider?: string;   // 归属的 provider ID，如 "openai" (可选)
  inputPrice: number;  // 每百万 input tokens 美元价格
  outputPrice: number; // 每百万 output tokens 美元价格
}

// ---- 静态 Provider 信息（向后兼容前端页面用） ----
export interface ProviderInfo {
  id: string;          // "openai" | "anthropic" | "deepseek" | "google" | "custom"
  name: string;        // "OpenAI" | "Anthropic" | "DeepSeek" | "Google"
  format: ApiFormat;   // ★ API 协议格式
  defaultBaseUrl?: string;  // 默认 API 地址
  models: ModelInfo[];
}

// ---- 用户配置的 Provider ----
// 对应数据库 ApiKey 表的一条记录，包含该 Provider 下配置的所有模型
export interface UserProviderConfig {
  id: string;           // 数据库记录 ID
  label: string;        // 用户给的备注名
  format: ApiFormat;    // API 协议格式
  baseUrl?: string;     // 自定义 API 地址
  models: ModelInfo[];  // 该 Provider 下配置的模型列表
}

// ---- 前端用的模型信息 ----
// 聚合了 Provider 信息，方便前端 Model Selector 展示
export interface UserModelInfo {
  id: string;            // 模型 ID
  name: string;          // 显示名
  providerId: string;    // 所属 Provider 的数据库 ID
  providerLabel: string; // Provider 的备注名
  format: ApiFormat;     // API 协议格式
  inputPrice: number;    // 每百万 input tokens 美元价格
  outputPrice: number;   // 每百万 output tokens 美元价格
}

// ---- API 格式的显示名映射（Settings 页面用） ----
export const API_FORMAT_LABELS: Record<ApiFormat, string> = {
  "openai":           "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses API",
  "anthropic":        "Anthropic Messages",
  "google-genai":     "Google Generative AI",
};

export const SUGGESTED_MODELS: Record<ApiFormat, ModelInfo[]> = {
  "openai": [
    { id: "gpt-4o", name: "GPT-4o", inputPrice: 2.5, outputPrice: 10 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", inputPrice: 0.15, outputPrice: 0.6 },
    { id: "deepseek-chat", name: "DeepSeek V3", inputPrice: 0.27, outputPrice: 1.1 },
    { id: "deepseek-reasoner", name: "DeepSeek R1", inputPrice: 0.55, outputPrice: 2.19 },
  ],
  "openai-responses": [],
  "anthropic": [],
  "google-genai": [],
};

