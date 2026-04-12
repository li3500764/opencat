// ============================================================
// ReAct Agent Engine — 推理引擎（Day 4 核心中的核心）
// ============================================================
//
// 什么是 ReAct？
// ---
// ReAct 是一种 Agent 架构模式，全称 "Reasoning + Acting"（推理 + 行动）。
// 论文：https://arxiv.org/abs/2210.03629
//
// 核心思想：
//   LLM 不仅生成文字，还能「思考 → 调用工具 → 观察结果 → 继续思考」循环执行。
//
// 一轮 ReAct 循环是这样的：
//   1. Think（思考）：LLM 分析用户问题，决定下一步行动
//   2. Act（行动）：LLM 调用一个或多个工具（Tool Calling）
//   3. Observe（观察）：把工具返回的结果喂回给 LLM
//   4. LLM 根据观察结果，决定是继续调用工具还是生成最终回复
//
// 循环示例（用户问"123 * 456 + 789"）：
//   Step 1: LLM 思考 → 需要计算 → 调用 calculator("123 * 456")
//   Step 2: 工具返回 56088 → LLM 继续 → 调用 calculator("56088 + 789")
//   Step 3: 工具返回 56877 → LLM 决定回答 → "结果是 56877"
//
// 为什么不直接用 LangChain？
// ---
// 面试差异化！自己实现 ReAct 能讲清：
// - streamText + tools + stopWhen 的工作原理
// - 为什么需要 multi-step（多步循环）
// - 如何防止无限循环（stepCountIs 限制）
// - 工具执行结果如何流转回 LLM
//
// AI SDK 6.x 中的实现：
// ---
// AI SDK 的 streamText() 天然支持 ReAct！只需要：
//   1. 传入 tools（工具集）→ LLM 就能调用工具
//   2. 传入 stopWhen: stepCountIs(N) → 限制最多循环 N 步
//   3. AI SDK 会自动处理：调用工具 → 拿到结果 → 喂回 LLM → 继续的循环
// 我们要做的是「封装」这些参数，提供一个更高层的 Agent 接口。
//
// ============================================================

import { streamText, stepCountIs, type LanguageModel } from "ai";
import type { ToolSet } from "ai";
import type { ModelMessage } from "ai";
import { toolRegistry } from "../tools";
import type { ToolExecutionContext } from "../tools";

// ---------- Agent 配置类型 ----------
// 创建 Agent 引擎时需要传入的配置
export interface AgentConfig {
  // LLM 模型实例（通过 createModel() 创建的）
  model: LanguageModel;

  // 系统提示词
  // 这是 Agent 的「人格」——告诉 LLM 它是谁、该怎么做
  // system prompt 的质量直接决定 Agent 的表现
  systemPrompt?: string;

  // 最大步数（防止无限循环）
  // 一步 = LLM 生成一次（可能包含文字或工具调用）
  // 默认 10 步：足够处理大多数场景，又不会无限跑下去
  maxSteps?: number;

  // 指定要使用的工具名列表
  // 如果不传，使用注册中心里所有已启用的工具
  toolNames?: string[];

  // 工具执行上下文（userId、conversationId 等）
  context: ToolExecutionContext;
}

// ---------- Agent 执行选项 ----------
// 每次调用 Agent 时传入的选项
export interface AgentRunOptions {
  // 对话消息列表（ModelMessage 格式，已经过 convertToModelMessages 转换）
  messages: ModelMessage[];
}

// ---------- 默认系统提示词 ----------
// 这个提示词定义了 Agent 的行为规范
// 好的系统提示词应该：
//   1. 说明 Agent 有哪些工具可用
//   2. 指导 Agent 何时使用工具
//   3. 规范 Agent 的回答格式
const DEFAULT_SYSTEM_PROMPT = `你是 OpenCat 智能助手。你有以下工具可以使用：

1. **calculator** — 数学计算工具。当用户需要精确计算时使用。
2. **datetime** — 日期时间工具。当用户询问当前时间或需要日期计算时使用。
3. **http_request** — HTTP 请求工具。当需要从外部 API 获取数据时使用。

使用工具的原则：
- 需要精确计算时，务必使用 calculator，不要自己算
- 用户问现在几点时，务必使用 datetime，不要猜测
- 如果不需要工具就能回答的问题，直接回答即可
- 工具调用的结果会自动返回给你，你需要根据结果组织回复

请用中文回复用户。`;

// ============================================================
// 创建 Agent 流式响应
// ============================================================
//
// 这是 Day 4 的核心函数！
//
// 它的作用：
//   把"普通的聊天"升级为"带工具的 Agent 对话"
//
// 原来的 Chat API（Day 2-3）：
//   streamText({ model, messages }) → 纯文字流
//
// 现在的 Agent Engine（Day 4）：
//   streamText({ model, messages, tools, stopWhen }) → 文字 + 工具调用流
//
// 关键参数解释：
//
// tools:
//   一个 Record<string, Tool>，告诉 LLM 有哪些工具可用
//   LLM 的 function calling 能力会根据用户输入决定是否调用
//
// stopWhen: stepCountIs(N):
//   AI SDK 6.x 新 API，替代了旧版的 maxSteps
//   stepCountIs(10) 表示「最多执行 10 步后强制停止」
//   一步 = LLM 生成一次回复（可能是纯文字或工具调用）
//   如果 LLM 在第 3 步就生成了纯文字回复（没有工具调用），就自然停止
//   stopWhen 只是一个「安全阀」，防止 LLM 无限调工具
//
// 返回值：
//   返回 streamText 的 StreamTextResult
//   调用方可以用 .toUIMessageStreamResponse() 转成 SSE 流
//
export function createAgentStream(config: AgentConfig, options: AgentRunOptions) {
  const {
    model,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxSteps = 10,
    toolNames,
    context,
  } = config;

  // ---- 1. 从注册中心获取 AI SDK 格式的工具集 ----
  // toolRegistry.toAISDKTools() 做了什么？
  //   → 遍历所有已注册的工具
  //   → 用 AI SDK 的 tool() 函数包装每个工具
  //   → 返回 { calculator: Tool, datetime: Tool, ... } 格式
  const tools: ToolSet = toolRegistry.toAISDKTools(context, toolNames);

  // ---- 2. 判断是否有可用工具 ----
  // 如果没有工具可用，就退化为普通聊天（不带 tools 参数）
  const hasTools = Object.keys(tools).length > 0;

  // ---- 3. 调用 streamText 创建流式响应 ----
  // 这是 AI SDK 的核心 API，底层帮我们处理了 ReAct 循环：
  //
  //   streamText 内部的伪代码（帮你理解原理）：
  //   ```
  //   let step = 0;
  //   while (step < maxSteps) {
  //     step++;
  //     const response = await llm.call(messages, tools);
  //
  //     if (response.hasToolCalls) {
  //       // LLM 想调用工具
  //       for (const call of response.toolCalls) {
  //         const result = await tools[call.name].execute(call.args);
  //         messages.push({ role: "tool", content: result });
  //       }
  //       // 继续循环，把工具结果喂回 LLM
  //     } else {
  //       // LLM 生成了纯文字回复，ReAct 循环结束
  //       break;
  //     }
  //   }
  //   ```
  //
  //   实际上 AI SDK 是流式的，上面只是概念性的伪代码
  //   流式意味着：文字一个一个 token 传回前端，工具调用也实时显示

  const result = streamText({
    // 模型实例
    model,

    // 系统提示词（注入 Agent 行为规范）
    system: systemPrompt,

    // 对话消息
    messages: options.messages,

    // 工具集（有工具才传，没工具就不传）
    ...(hasTools ? { tools } : {}),

    // 停止条件：最多 maxSteps 步
    // 如果 LLM 在某步生成纯文字回复（不调用工具），就自然停止
    // stepCountIs(10) 只是安全阀，实际很少走满 10 步
    ...(hasTools
      ? { stopWhen: stepCountIs(maxSteps) }
      : {}),
  });

  return result;
}

// ============================================================
// 获取可用工具列表（给前端展示用）
// ============================================================
// 返回所有已注册工具的名称和描述，用于：
// 1. 前端显示"当前 Agent 有哪些工具可用"
// 2. Settings 页面管理工具开关
export function getAvailableTools() {
  return toolRegistry.getAll().map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    type: t.type,
    enabled: t.enabled,
  }));
}
