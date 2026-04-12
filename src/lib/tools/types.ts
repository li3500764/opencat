// ============================================================
// Tool 类型定义（Day 4 核心）
// ============================================================
//
// 为什么自定义 Tool 类型？
// ---
// AI SDK 6.x 提供了 `tool()` 函数来定义工具，但它的类型是与 AI SDK 深度耦合的。
// 我们需要一个「业务层」的 Tool 类型定义，用于：
// 1. 数据库中存储工具配置（Prisma Tool 表）
// 2. 工具注册中心管理（注册、查找、启用/禁用）
// 3. 最终转换成 AI SDK 的 ToolSet 格式，传给 streamText()
//
// 架构分层：
//   ToolDefinition（我们定义的）→ 转换 → AI SDK tool()（框架的）→ 传入 streamText()
//
// 这样做的好处：
// - 与框架解耦：如果将来换 AI 框架，只需改转换层
// - 面试时能讲清"为什么不直接用 AI SDK 的 tool"：体现工程抽象能力
// ============================================================

import type { z } from "zod";

// ---------- 工具类型枚举 ----------
// 与 Prisma schema 中的 ToolType enum 保持一致
export type ToolType = "builtin" | "http" | "mcp";

// ---------- 工具执行结果 ----------
// 工具执行后返回的统一格式
export interface ToolExecutionResult {
  // 执行是否成功
  success: boolean;
  // 结果数据（成功时）
  data?: unknown;
  // 错误信息（失败时）
  error?: string;
}

// ---------- 工具执行上下文 ----------
// 传给工具 execute 函数的额外信息
// 这些信息不是工具参数，而是运行时的上下文（谁在调用、哪个会话、哪个项目）
export interface ToolExecutionContext {
  // 当前用户 ID（用于权限控制）
  userId: string;
  // 当前会话 ID（可选，有些工具可能需要知道在哪个对话中调用的）
  conversationId?: string;
  // 当前项目 ID（可选，用于项目隔离）
  projectId?: string;
}

// ---------- 内置工具定义 ----------
// 这是我们自定义的「业务层」工具接口
// 每个内置工具（calculator, datetime 等）都要实现这个接口
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDefinition<TInput = any> {
  // 工具唯一标识，如 "calculator"、"datetime"、"http_request"
  name: string;

  // 工具描述，会传给 LLM，让模型知道什么时候该调用这个工具
  // 描述写得好不好直接影响模型调用工具的准确性（重要！）
  description: string;

  // 参数的 Zod Schema
  // 为什么用 Zod 而不是 JSON Schema？
  // → AI SDK 6.x 的 tool() 函数直接接收 Zod schema
  // → Zod 自带类型推导，TS 能自动推出 execute 的参数类型
  // → Zod 可以 .toJSONSchema() 转成 JSON Schema 存数据库
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodType<TInput, any, any>;

  // 工具的实际执行函数
  // 接收两个参数：
  //   input: 经过 Zod 校验后的类型安全参数
  //   context: 运行时上下文（userId 等）
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

// ---------- HTTP 工具配置 ----------
// 当 ToolType 是 "http" 时，config 字段的结构
// 用户可以在 UI 上配置一个外部 API 作为工具（类似 GPTs 的 Actions）
export interface HttpToolConfig {
  // 请求地址
  url: string;
  // HTTP 方法
  method: "GET" | "POST" | "PUT" | "DELETE";
  // 自定义请求头
  headers?: Record<string, string>;
  // 超时时间（毫秒）
  timeout?: number;
}

// ---------- 工具注册信息 ----------
// 注册中心存储的完整工具信息
export interface RegisteredTool {
  // 工具定义（包含 name, description, parameters, execute）
  definition: ToolDefinition;
  // 工具类型
  type: ToolType;
  // 是否启用
  enabled: boolean;
}
