// ============================================================
// LLM 类型定义
// ============================================================

export interface ModelInfo {
  id: string;          // 模型 ID，如 "gpt-4o"
  name: string;        // 显示名，如 "GPT-4o"
  provider: string;    // 归属的 provider ID，如 "openai"
  inputPrice: number;  // 每百万 input tokens 美元价格
  outputPrice: number; // 每百万 output tokens 美元价格
}

export interface ProviderInfo {
  id: string;          // "openai" | "anthropic" | "deepseek" | "custom"
  name: string;        // "OpenAI" | "Anthropic"
  models: ModelInfo[];
}
