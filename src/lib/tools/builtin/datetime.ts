// ============================================================
// 内置工具：日期时间（datetime）
// ============================================================
//
// 功能：获取当前时间、日期计算、时区转换
//
// 为什么需要日期工具？
// → LLM 的训练数据有截止日期，不知道"现在几点"
// → 日期计算（两个日期差多少天）也容易算错
// → 通过 Tool Calling 让模型获取实时时间信息
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";

// ---------- 参数 Schema ----------
// 使用 Zod 的 discriminatedUnion 做「子命令」模式
// 也就是说，一个工具可以有多种操作模式，通过 action 字段区分
const datetimeSchema = z.object({
  // action 字段决定执行哪种操作
  action: z
    .enum(["now", "format", "diff"])
    .describe(
      "操作类型：" +
        "now = 获取当前时间，" +
        "format = 格式化指定时间戳，" +
        "diff = 计算两个日期的差值"
    ),

  // 时区，可选。默认 Asia/Shanghai
  timezone: z
    .string()
    .optional()
    .describe("IANA 时区名，如 'Asia/Shanghai'、'America/New_York'。默认 Asia/Shanghai"),

  // 以下字段是 format / diff 操作需要的
  // 可选字段：Zod 的 optional() 意味着不传也行

  // 格式化操作需要的时间戳
  timestamp: z
    .string()
    .optional()
    .describe("ISO 8601 格式的时间字符串，如 '2024-01-15T10:30:00Z'。用于 format 操作"),

  // 差值计算需要的两个日期
  date1: z
    .string()
    .optional()
    .describe("第一个日期（ISO 8601 格式）。用于 diff 操作"),

  date2: z
    .string()
    .optional()
    .describe("第二个日期（ISO 8601 格式）。用于 diff 操作"),
});

type DatetimeInput = z.infer<typeof datetimeSchema>;

// ---------- 内部处理函数 ----------

/**
 * 获取当前时间（指定时区）
 */
function handleNow(timezone: string) {
  const now = new Date();

  // Intl.DateTimeFormat 是 JS 原生的国际化 API
  // 可以按指定时区格式化日期，不需要额外库（如 dayjs/moment）
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hour12: false,
  });

  return {
    // 格式化后的人类可读时间
    formatted: formatter.format(now),
    // ISO 标准格式（方便程序处理）
    iso: now.toISOString(),
    // Unix 时间戳（秒）
    timestamp: Math.floor(now.getTime() / 1000),
    timezone,
  };
}

/**
 * 格式化指定时间戳
 */
function handleFormat(timestamp: string, timezone: string) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的时间格式: "${timestamp}"`);
  }

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hour12: false,
  });

  return {
    formatted: formatter.format(date),
    iso: date.toISOString(),
    timestamp: Math.floor(date.getTime() / 1000),
    timezone,
  };
}

/**
 * 计算两个日期的差值
 */
function handleDiff(date1Str: string, date2Str: string) {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);

  if (isNaN(d1.getTime())) throw new Error(`无效的日期: "${date1Str}"`);
  if (isNaN(d2.getTime())) throw new Error(`无效的日期: "${date2Str}"`);

  // 计算毫秒差
  const diffMs = Math.abs(d2.getTime() - d1.getTime());

  // 转换成人类可读的单位
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  return {
    date1: d1.toISOString(),
    date2: d2.toISOString(),
    diff: {
      days: diffDays,
      hours: diffHours,
      minutes: diffMinutes,
      milliseconds: diffMs,
    },
    // 人类可读描述
    readable: `${diffDays} 天 ${diffHours % 24} 小时 ${diffMinutes % 60} 分钟`,
  };
}

// ---------- 导出工具定义 ----------
export const datetimeTool: ToolDefinition<DatetimeInput> = {
  name: "datetime",

  description:
    "日期时间工具。支持三种操作：" +
    "(1) now — 获取当前日期和时间；" +
    "(2) format — 格式化指定的时间戳到指定时区；" +
    "(3) diff — 计算两个日期之间的差值。" +
    "当用户询问当前时间、需要日期计算或时区转换时使用此工具。",

  parameters: datetimeSchema,

  execute: async (input, _context) => {
    try {
      // 默认时区：中国标准时间
      const timezone = input.timezone || "Asia/Shanghai";

      // 根据 action 分派到不同的处理函数
      switch (input.action) {
        case "now":
          return { success: true, data: handleNow(timezone) };

        case "format":
          if (!input.timestamp) {
            return { success: false, error: "format 操作需要提供 timestamp 参数" };
          }
          return { success: true, data: handleFormat(input.timestamp, timezone) };

        case "diff":
          if (!input.date1 || !input.date2) {
            return { success: false, error: "diff 操作需要提供 date1 和 date2 参数" };
          }
          return { success: true, data: handleDiff(input.date1, input.date2) };

        default:
          return { success: false, error: `未知操作: ${input.action}` };
      }
    } catch (err) {
      return {
        success: false,
        error: `日期时间操作失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
