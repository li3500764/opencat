// ============================================================
// 内置工具：call_agent — Orchestrator 的子 Agent 调用工具（Day 5）
// ============================================================
//
// 什么是 Orchestrator Agent？
// ---
// Orchestrator（编排者）是一种特殊的 Agent，它的工作不是自己直接回答问题，
// 而是「分配任务给其他 Agent」。
//
// 类比：
//   普通 Agent = 普通员工，自己干活
//   Orchestrator = 项目经理，把任务分配给对应的员工
//
// 例子：
//   用户问："帮我查一下今天的天气，然后算一下华氏温度转摄氏"
//
//   Orchestrator 的思考过程：
//   1. "查天气" → 交给「研究助手 Agent」（它有 http_request 工具）
//   2. 拿到天气数据后 → "温度转换" → 交给「数学助手 Agent」（它有 calculator 工具）
//   3. 汇总两个 Agent 的结果 → 生成最终回复
//
// 实现原理：
// ---
// call_agent 本质上是一个「工具」：
//   - Orchestrator 通过 Tool Calling 调用 call_agent
//   - call_agent 内部创建一个子 Agent 实例
//   - 子 Agent 用 generateText（非流式）执行任务
//   - 把子 Agent 的回复返回给 Orchestrator
//
// 为什么用 generateText 而不是 streamText？
// → 子 Agent 的结果是工具返回值，不需要流式
// → Orchestrator 需要拿到完整结果后才能继续推理
//
// ============================================================

import { z } from "zod";
import { generateText, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { toolRegistry } from "../registry";
import type { ToolDefinition, ToolExecutionContext } from "../types";

// ---------- 参数 Schema ----------
const callAgentSchema = z.object({
  // 要调用的子 Agent 名称或 ID
  agentName: z
    .string()
    .describe("要调用的子 Agent 的名称，如 '数学助手' 或 '研究助手'"),

  // 交给子 Agent 的任务描述
  task: z
    .string()
    .describe("交给子 Agent 执行的任务描述，要清楚说明需要做什么"),
});

type CallAgentInput = z.infer<typeof callAgentSchema>;

// ---------- 子 Agent 信息类型 ----------
// Orchestrator 需要知道有哪些子 Agent 可用
export interface SubAgentInfo {
  name: string;
  description: string;
  systemPrompt: string;
  model: LanguageModel;
  toolNames: string[];
  maxSteps: number;
}

// ---------- 创建 call_agent 工具 ----------
// 这是一个工厂函数，因为 call_agent 需要运行时信息：
//   - 有哪些子 Agent 可用
//   - 每个子 Agent 的模型实例
//
// 不像 calculator/datetime 那样可以直接导出静态工具定义，
// call_agent 需要根据当前项目的 Agent 配置动态创建
export function createCallAgentTool(
  subAgents: SubAgentInfo[]
): ToolDefinition<CallAgentInput> {
  // 构建子 Agent 名称列表，写进工具描述
  // 让 Orchestrator 知道有哪些子 Agent 可以调用
  const agentListDesc = subAgents
    .map((a) => `- "${a.name}": ${a.description}`)
    .join("\n");

  return {
    name: "call_agent",

    description:
      "调用一个子 Agent 来执行特定任务。当你需要将任务分配给专门的 Agent 时使用此工具。\n\n" +
      "可用的子 Agent：\n" +
      agentListDesc +
      "\n\n请根据任务性质选择合适的子 Agent。",

    parameters: callAgentSchema,

    execute: async (input: CallAgentInput, context: ToolExecutionContext) => {
      // 查找目标子 Agent
      const targetAgent = subAgents.find(
        (a) => a.name.toLowerCase() === input.agentName.toLowerCase()
      );

      if (!targetAgent) {
        return {
          success: false,
          error: `找不到名为 "${input.agentName}" 的 Agent。可用的 Agent: ${subAgents.map((a) => a.name).join(", ")}`,
        };
      }

      try {
        // 获取子 Agent 可用的工具集
        const tools = toolRegistry.toAISDKTools(context, targetAgent.toolNames);

        // 用 generateText（非流式）调用子 Agent
        // 子 Agent 完整执行后返回结果给 Orchestrator
        const result = await generateText({
          model: targetAgent.model,
          system: targetAgent.systemPrompt,
          prompt: input.task,
          // 如果子 Agent 有工具，传入 tools 和 stopWhen
          ...(Object.keys(tools).length > 0
            ? { tools, stopWhen: stepCountIs(targetAgent.maxSteps) }
            : {}),
        });

        return {
          success: true,
          data: {
            agent: targetAgent.name,
            task: input.task,
            // 子 Agent 的回复文本
            response: result.text,
            // 子 Agent 执行了多少步
            steps: result.steps.length,
            // Token 用量
            usage: {
              totalTokens: result.usage?.totalTokens ?? 0,
            },
          },
        };
      } catch (err) {
        return {
          success: false,
          error: `子 Agent "${targetAgent.name}" 执行失败: ${
            err instanceof Error ? err.message : "未知错误"
          }`,
        };
      }
    },
  };
}
