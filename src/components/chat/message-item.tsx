// ============================================================
// 单条消息组件（Day 4: 支持 Tool Calling UI）
// ============================================================
//
// Day 4 升级：
// 消息的 parts 数组不再只有 type: "text"，还可能有：
//   - type: "tool-xxx"（静态工具调用，xxx 是工具名）
//   - type: "dynamic-tool"（动态工具调用）
//
// 每个 tool part 有 state 属性，表示工具调用的进度：
//   - "input-streaming" — 正在生成工具参数（流式）
//   - "input-available" — 参数生成完毕，等待执行
//   - "output-available" — 工具执行完毕，有结果
//   - "output-error" — 工具执行出错
//
// 我们需要为每种状态渲染不同的 UI，让用户看到：
//   "正在调用计算器..." → "计算器返回: 42"
//
// 样式保持 Evose 风格：干净、克制、不花哨
// ============================================================

"use client";

import { useState } from "react";
import { Cat, User, Wrench, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Markdown } from "./markdown";
import { useTranslation } from "@/lib/i18n";
import type { UIMessage } from "ai";

// AI SDK 6.x 的 UIMessagePart 需要两个泛型参数
// 为了简化使用，我们定义一个类型别名
// UIMessage 默认泛型参数是 UIDataTypes 和 UITools
// 直接用 UIMessage["parts"][number] 来获取 part 的类型
type MessagePart = UIMessage["parts"][number];

// ============================================================
// 工具调用的类型判断
// ============================================================
//
// AI SDK 6.x 的 UIMessage.parts 中，工具调用有两种 type：
//   1. "tool-xxx"：静态工具（在 streamText 的 tools 参数中声明的）
//      比如 type: "tool-calculator", type: "tool-datetime"
//   2. "dynamic-tool"：动态工具（运行时临时创建的）
//
// 我们用正则来判断是否是工具类型的 part
function isToolPart(part: MessagePart): boolean {
  // 匹配 "tool-calculator"、"tool-datetime"、"tool-http_request" 等
  // 也匹配 "dynamic-tool"
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

// 从 tool part 中提取工具名
// "tool-calculator" → "calculator"
// "dynamic-tool" → 从 part.toolName 取
function getToolNameFromPart(part: MessagePart): string {
  if (part.type === "dynamic-tool") {
    // dynamic-tool 的工具名在 toolName 字段
    return (part as { type: "dynamic-tool"; toolName: string }).toolName || "unknown";
  }
  // 静态工具：去掉 "tool-" 前缀
  return part.type.replace("tool-", "");
}

// 从工具 part 中安全地提取公共字段
// 因为 ToolUIPart 的类型很复杂（联合类型），我们用 unknown 安全提取
function getToolPartInfo(part: MessagePart) {
  const p = part as unknown as {
    type: string;
    toolName?: string;
    toolCallId?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
  return {
    toolName: p.toolName || getToolNameFromPart(part),
    toolCallId: p.toolCallId || "",
    state: p.state || "input-streaming",
    input: p.input,
    output: p.output,
    errorText: p.errorText,
  };
}

// ============================================================
// 工具名的图标配色
// ============================================================
const TOOL_COLORS: Record<string, string> = {
  calculator:      "text-amber-600 dark:text-amber-400",
  datetime:        "text-sky-600 dark:text-sky-400",
  http_request:    "text-emerald-600 dark:text-emerald-400",
  memory_save:     "text-violet-600 dark:text-violet-400",
  memory_search:   "text-indigo-600 dark:text-indigo-400",
  call_agent:      "text-rose-600 dark:text-rose-400",
};

// ============================================================
// ToolCallCard — 单个工具调用的卡片组件
// ============================================================
//
// 展示一次工具调用的完整信息：
//   头部：工具名 + 状态指示器（loading/success/error）
//   可展开：显示输入参数 + 输出结果
//
function ToolCallCard({ part }: { part: MessagePart }) {
  // 是否展开详情（默认折叠，节省空间）
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const info = getToolPartInfo(part);
  const toolKey = `tools.${info.toolName}` as Parameters<typeof t>[0];
  const label = t(toolKey);
  const color = TOOL_COLORS[info.toolName] || "text-muted";

  // 根据状态选择图标
  const stateIcon = (() => {
    switch (info.state) {
      case "input-streaming":
      case "input-available":
        // 正在执行中：显示 loading 动画
        return <Loader2 className="h-3 w-3 animate-spin text-muted" />;
      case "output-available":
        // 执行成功：绿色 ✓
        return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      case "output-error":
        // 执行失败：红色 ✗
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Loader2 className="h-3 w-3 animate-spin text-muted" />;
    }
  })();

  // 是否已完成（有输出或有错误）
  const isDone = info.state === "output-available" || info.state === "output-error";

  return (
    <div className="my-1.5 rounded-lg border border-border/60 bg-foreground/[0.02] overflow-hidden">
      {/* 卡片头部：可点击展开/折叠 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/[0.03]"
      >
        {/* 展开箭头 */}
        {expanded
          ? <ChevronDown className="h-3 w-3 text-muted shrink-0" />
          : <ChevronRight className="h-3 w-3 text-muted shrink-0" />
        }

        {/* 工具图标 */}
        <Wrench className={`h-3 w-3 shrink-0 ${color}`} />

        {/* 工具名 */}
        <span className={`font-medium ${color}`}>
          {label}
        </span>

        {/* 状态图标（右侧） */}
        <span className="ml-auto">{stateIcon}</span>
      </button>

      {/* 展开后显示详情 */}
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2">
          {/* 输入参数 */}
          {info.input != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                {t('tools.inputParams')}
              </p>
              <pre className="rounded-md bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] text-foreground/80 overflow-x-auto">
                {JSON.stringify(info.input, null, 2)}
              </pre>
            </div>
          )}

          {/* 输出结果（成功时） */}
          {isDone && info.output != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                {t('tools.outputResult')}
              </p>
              <pre className="rounded-md bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] text-foreground/80 overflow-x-auto">
                {JSON.stringify(info.output, null, 2)}
              </pre>
            </div>
          )}

          {/* 错误信息 */}
          {info.errorText && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">
                {t('tools.error')}
              </p>
              <pre className="rounded-md bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-600 dark:text-red-400 overflow-x-auto">
                {info.errorText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MessageItem — 单条消息主组件
// ============================================================
export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const { t } = useTranslation();

  // ---- 分离 parts：文本 vs 工具调用 ----
  // message.parts 是一个数组，可能混合了文本和工具调用
  // 例如：[text, tool-calculator, text, tool-datetime, text]
  // 我们需要按顺序渲染它们
  const textParts = message.parts.filter(
    (p): p is { type: "text"; text: string } => p.type === "text"
  );
  const toolParts = message.parts.filter(isToolPart);
  const fullText = textParts.map((p) => p.text).join("");

  // 如果没有任何内容（既没文本也没工具调用），不渲染
  if (!fullText && toolParts.length === 0) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* 头像 */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-accent/10 text-accent"
            : "bg-foreground/[0.06] text-muted"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Cat className="h-3.5 w-3.5" />}
      </div>

      {/* 消息内容 */}
      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        {/* 角色标签 */}
        <p className="mb-1 text-[11px] font-medium text-muted">
          {isUser ? t('chat.you') : t('chat.assistant')}
        </p>

        {/* 消息体 */}
        {isUser ? (
          // 用户消息：灰色气泡
          <div className="inline-block rounded-2xl rounded-tr-md bg-message-user-bg px-4 py-2.5 text-message-user-text">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{fullText}</p>
          </div>
        ) : (
          // AI 消息：按 parts 顺序渲染
          <div className="rounded-2xl rounded-tl-md">
            {/* ★ Day 4 新增：按 parts 顺序渲染 */}
            {/* 先渲染工具调用卡片（它们通常出现在文本回复之前） */}
            {toolParts.length > 0 && (
              <div className="mb-2">
                {toolParts.map((part, i) => (
                  <ToolCallCard key={i} part={part} />
                ))}
              </div>
            )}

            {/* 文本内容 */}
            {fullText && <Markdown content={fullText} />}
          </div>
        )}
      </div>
    </div>
  );
}
