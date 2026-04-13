// ============================================================
// ReAct Agent Engine — 推理引擎（Day 5: Orchestrator 支持）
// ============================================================
//
// Day 5 升级：
// 1. 新增 Orchestrator 模式 — Agent 可以调用其他 Agent
// 2. createAgentStream 增加 subAgents 参数
// 3. 当 subAgents 非空时，自动注册 call_agent 工具
//
// Orchestrator 工作流：
//   用户消息 → Orchestrator Agent
//     → 思考：这个问题需要哪个子 Agent？
//     → 调用 call_agent 工具（指定子 Agent + 任务）
//     → call_agent 内部：子 Agent 执行任务（可能也会调工具）
//     → 子 Agent 返回结果
//     → Orchestrator 拿到结果，继续思考或生成最终回复
//
// ============================================================

import { streamText, stepCountIs, type LanguageModel } from "ai";
import type { ToolSet } from "ai";
import type { ModelMessage } from "ai";
import { toolRegistry, createCallAgentTool } from "../tools";
import type { ToolExecutionContext, SubAgentInfo } from "../tools";

// ---------- Agent 配置类型 ----------
export interface AgentConfig {
  model: LanguageModel;
  systemPrompt?: string;
  maxSteps?: number;
  toolNames?: string[];
  context: ToolExecutionContext;

  // ★ Day 5 新增：子 Agent 列表（Orchestrator 模式专用）
  // 如果提供了子 Agent，会自动注册 call_agent 工具
  subAgents?: SubAgentInfo[];

  // ★ Day 6 新增：系统提示词后缀（Memory + RAG 注入内容）
  // Chat API 会把检索到的记忆和知识库片段拼成 suffix，
  // 追加到系统提示词末尾，让 LLM 在回答时参考这些背景信息
  _systemPromptSuffix?: string;
}

// ---------- Agent 执行选项 ----------
export interface AgentRunOptions {
  messages: ModelMessage[];
}

// ---------- 默认系统提示词 ----------
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
export function createAgentStream(config: AgentConfig, options: AgentRunOptions) {
  const {
    model,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxSteps = 10,
    toolNames,
    context,
    subAgents,
    _systemPromptSuffix,  // ★ Day 6: Memory + RAG 注入的后缀
  } = config;

  // ★ Day 6: 拼接系统提示词 + 后缀（记忆 / RAG 内容）
  // 如果有 suffix，追加到系统提示词末尾
  // 这样 LLM 在回答时会把记忆和知识库片段当作"背景资料"参考
  const finalSystemPrompt = _systemPromptSuffix
    ? systemPrompt + "\n" + _systemPromptSuffix
    : systemPrompt;

  // ---- 1. 从注册中心获取工具集 ----
  const tools: ToolSet = toolRegistry.toAISDKTools(context, toolNames);

  // ---- 2. ★ Day 5: Orchestrator 模式 — 注册 call_agent 工具 ----
  //
  // 如果有子 Agent，动态创建 call_agent 工具并注入到工具集中
  // call_agent 不是静态注册在 registry 里的（因为它依赖运行时的子 Agent 列表）
  // 而是每次请求时根据 subAgents 动态创建
  //
  if (subAgents && subAgents.length > 0) {
    const callAgentToolDef = createCallAgentTool(subAgents);

    // 直接插入到工具集（与 registry.toAISDKTools 返回格式一致）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tools as Record<string, any>)["call_agent"] = {
      description: callAgentToolDef.description,
      parameters: callAgentToolDef.parameters,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => {
        return callAgentToolDef.execute(input, context);
      },
    };
  }

  // ---- 3. 判断是否有可用工具 ----
  const hasTools = Object.keys(tools).length > 0;

  // ---- 4. 调用 streamText 创建流式响应 ----
  const result = streamText({
    model,
    system: finalSystemPrompt,
    messages: options.messages,
    ...(hasTools ? { tools } : {}),
    ...(hasTools ? { stopWhen: stepCountIs(maxSteps) } : {}),
  });

  return result;
}

// ============================================================
// 获取可用工具列表（给前端展示用）
// ============================================================
export function getAvailableTools() {
  return toolRegistry.getAll().map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    type: t.type,
    enabled: t.enabled,
  }));
}
