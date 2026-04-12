// ============================================================
// 内置工具：HTTP 请求（http_request）
// ============================================================
//
// 功能：让 AI Agent 能调用外部 HTTP API
//
// 为什么需要 HTTP 工具？
// → 这是 Agent 与外部世界交互的基础能力
// → 模型可以通过这个工具查询天气、汇率、新闻等外部数据
// → 也是用户自定义"HTTP 类型工具"的底层实现
//
// 安全措施：
// → 只允许 GET 和 POST（不允许 DELETE/PUT 等危险操作）
// → 请求超时限制（默认 10 秒）
// → 响应体大小限制（最多取前 5000 字符）
// → 生产环境应该加 URL 白名单，这里为了演示简化了
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";

// ---------- 参数 Schema ----------
const httpRequestSchema = z.object({
  // 请求地址
  url: z
    .string()
    .url()  // Zod 内置的 URL 格式校验
    .describe("要请求的 URL，必须是完整的 HTTP/HTTPS 地址"),

  // 请求方法（只允许安全的方法）
  method: z
    .enum(["GET", "POST"])
    .default("GET")
    .describe("HTTP 请求方法，默认 GET"),

  // 请求头（可选）
  headers: z
    .record(z.string(), z.string())  // Record<string, string> — Zod v4 需要两个参数（key schema, value schema）
    .optional()
    .describe("自定义请求头，如 { 'Authorization': 'Bearer xxx' }"),

  // 请求体（POST 用）
  body: z
    .string()
    .optional()
    .describe("POST 请求的 body，JSON 字符串格式"),
});

type HttpRequestInput = z.infer<typeof httpRequestSchema>;

// ---------- 常量配置 ----------
// 请求超时：10 秒
const REQUEST_TIMEOUT = 10_000;
// 响应体最大长度：5000 字符
// 为什么限制？→ 避免超大响应撑爆 LLM 的 context window
const MAX_RESPONSE_LENGTH = 5000;

// ---------- 导出工具定义 ----------
export const httpRequestTool: ToolDefinition<HttpRequestInput> = {
  name: "http_request",

  description:
    "发送 HTTP 请求并返回响应内容。支持 GET 和 POST 方法。" +
    "当需要从外部 API 获取数据时使用此工具，例如查询天气、汇率、新闻等。" +
    "注意：响应内容会被截断到 5000 字符以内。",

  parameters: httpRequestSchema,

  execute: async (input, _context) => {
    try {
      // AbortController 用于实现请求超时
      // 这是现代 JS 的标准做法（替代老式的 setTimeout + xhr.abort）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      // 构造 fetch 选项
      const fetchOptions: RequestInit = {
        method: input.method,
        headers: input.headers as Record<string, string> | undefined,
        signal: controller.signal,  // 关联 AbortController
      };

      // POST 请求才带 body
      if (input.method === "POST" && input.body) {
        fetchOptions.body = input.body;
        // 如果没指定 Content-Type，默认用 JSON
        if (!input.headers?.["Content-Type"]) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            "Content-Type": "application/json",
          };
        }
      }

      // 发请求
      const response = await fetch(input.url, fetchOptions);

      // 清除超时计时器
      clearTimeout(timeoutId);

      // 读取响应文本
      let responseText = await response.text();

      // 截断超长响应
      if (responseText.length > MAX_RESPONSE_LENGTH) {
        responseText =
          responseText.slice(0, MAX_RESPONSE_LENGTH) +
          `\n...(截断，原始长度 ${responseText.length} 字符)`;
      }

      return {
        success: true,
        data: {
          // HTTP 状态码
          status: response.status,
          // 状态文本（如 "OK"、"Not Found"）
          statusText: response.statusText,
          // 响应头（转成普通对象）
          headers: Object.fromEntries(response.headers.entries()),
          // 响应体文本
          body: responseText,
        },
      };
    } catch (err) {
      // 区分超时和其他错误
      const isTimeout =
        err instanceof Error && err.name === "AbortError";

      return {
        success: false,
        error: isTimeout
          ? `请求超时（超过 ${REQUEST_TIMEOUT / 1000} 秒）`
          : `HTTP 请求失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
