// ============================================================
// 内置工具：计算器（calculator）
// ============================================================
//
// 功能：执行数学表达式计算
//
// 为什么需要计算器工具？
// → LLM 天生不擅长精确数学计算（比如大数乘法、小数运算）
// → 通过 Tool Calling，让模型识别出需要计算时调用这个工具
// → 工具用 JS 引擎做精确计算，把结果返回给模型
//
// 安全性：
// → 用 Function 构造器代替 eval()，限制作用域
// → 只允许数学相关的操作，禁止访问 global/require/process 等
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";

// ---------- 参数 Schema ----------
// 用 Zod 定义工具接收什么参数
// AI SDK 会把这个 schema 转成 JSON Schema 发给 LLM
// LLM 根据 schema 知道应该传什么格式的参数
const calculatorSchema = z.object({
  // 数学表达式字符串，比如 "2 + 3 * 4" 或 "(100 - 50) / 2"
  expression: z
    .string()
    .describe("数学表达式，例如 '2 + 3 * 4' 或 'Math.sqrt(144)'"),
});

// ---------- 从 Zod schema 推导出参数类型 ----------
// z.infer<typeof calculatorSchema> 自动推导出：
// { expression: string }
// 这就是下面 execute 函数的 input 参数类型
type CalculatorInput = z.infer<typeof calculatorSchema>;

// ---------- 安全计算函数 ----------
// 为什么不直接用 eval？
// → eval 可以访问当前作用域的所有变量，有安全风险
// → 用 Function 构造器可以限制作用域
// → 我们只注入 Math 对象，不暴露 process/require 等
function safeCalculate(expression: string): number {
  // 黑名单：禁止危险关键词
  const forbidden = [
    "require",
    "import",
    "process",
    "global",
    "eval",
    "Function",
    "fetch",
    "XMLHttpRequest",
  ];

  for (const word of forbidden) {
    if (expression.includes(word)) {
      throw new Error(`表达式中不允许使用 "${word}"`);
    }
  }

  // 用 Function 构造器创建一个沙箱函数
  // "use strict" 启用严格模式，进一步限制
  // 只传入 Math 对象，不传其他任何全局变量
  const fn = new Function(
    "Math",
    `"use strict"; return (${expression});`
  );

  // 执行计算，只传入 Math 对象
  const result = fn(Math);

  // 校验结果是数字
  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error(`计算结果不是有效数字: ${result}`);
  }

  return result;
}

// ---------- 导出工具定义 ----------
// 实现 ToolDefinition 接口
export const calculatorTool: ToolDefinition<CalculatorInput> = {
  // 工具名：LLM 用这个名字来指代这个工具
  name: "calculator",

  // 描述：非常重要！LLM 根据这段描述决定什么时候调用这个工具
  // 描述要清楚说明：工具做什么、什么时候该用、支持什么
  description:
    "执行数学计算。支持基础四则运算（+、-、*、/）和 Math 对象的方法" +
    "（如 Math.sqrt、Math.pow、Math.PI 等）。当用户需要精确计算数学表达式时使用此工具。",

  // Zod 参数 schema
  parameters: calculatorSchema,

  // 执行函数
  // input: 经过 Zod 校验的 { expression: string }
  // _context: 运行时上下文（计算器不需要，所以加下划线忽略）
  execute: async (input, _context) => {
    try {
      const result = safeCalculate(input.expression);
      return {
        success: true,
        data: {
          expression: input.expression,
          result,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `计算失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
