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
  if (!part || !part.type) return false;
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
// 格式化时间戳为 UTC+8 格式 (中国标准时间)，精确到秒
function formatTimeUTC8(dateInput: Date | string | number | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(date).replace(/\//g, "-");
  } catch (e) {
    // 兜底使用本地格式化
    return date.toLocaleString("zh-CN", { hour12: false });
  }
}

export function MessageItem({
  message,
  userAvatar,
  aiAvatar,
  onAvatarClick,
  onConfirmProposal,
}: {
  message: UIMessage;
  userAvatar: string;
  aiAvatar: string;
  onAvatarClick: (type: "user" | "ai") => void;
  onConfirmProposal?: (solution: string) => void;
}) {
  const isUser = message.role === "user";
  const { t } = useTranslation();

  // ---- 分离 parts：文本 vs 工具调用 (全面安全容错处理) ----
  // message.parts 是一个数组，可能混合了文本和工具调用
  // 例如：[text, tool-calculator, text, tool-datetime, text]
  const parts = message.parts || [{ type: "text" as const, text: (message as unknown as { content: string }).content || "" }];
  
  const textParts = parts.filter(
    (p): p is { type: "text"; text: string } => p && p.type === "text"
  );
  const toolParts = parts.filter((p) => p && isToolPart(p));
  const fullText = textParts.map((p) => p.text).join("");

  // 获取消息创建时间，优先使用 message.createdAt (通过类型转换避开 TS 限制)，其次尝试解析 message.id (时间戳字符串)，最后兜底用当前时间
  const getMessageTime = () => {
    const msg = message as unknown as { createdAt?: Date | string };
    if (msg.createdAt) {
      return new Date(msg.createdAt);
    }
    if (message.id) {
      const timestamp = parseInt(message.id, 10);
      if (!isNaN(timestamp) && timestamp > 1000000000000) {
        return new Date(timestamp);
      }
    }
    return new Date();
  };

  const formattedTime = formatTimeUTC8(getMessageTime());

  // 如果没有任何内容（既没文本也没工具调用），不渲染
  if (!fullText && toolParts.length === 0) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* 极富 Premium 动效的 Emoji 点击修改头像组件 */}
      <button
        onClick={() => onAvatarClick(isUser ? "user" : "ai")}
        title="点击修改头像 Emoji"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] border border-border/50 bg-card shadow-sm cursor-pointer hover:shadow hover:scale-[1.12] hover:rotate-[6deg] active:scale-[0.88] hover:border-foreground/10 transition-all select-none`}
      >
        {isUser ? userAvatar : aiAvatar}
      </button>


      {/* 消息内容 */}
      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        {/* 角色标签与时间戳 */}
        <div className={`mb-1 text-[11px] font-medium text-muted flex items-center gap-1.5 ${isUser ? "justify-end" : "justify-start"}`}>
          {isUser ? (
            <>
              <span className="text-[10px] opacity-60 font-mono">{formattedTime}</span>
              <span>{t('chat.you')}</span>
            </>
          ) : (
            <>
              <span>{t('chat.assistant')}</span>
              <span className="text-[10px] opacity-60 font-mono">{formattedTime}</span>
            </>
          )}
        </div>

        {/* 消息体 */}
        {isUser ? (
          <div className="flex flex-col items-end gap-2">
            {/* 渲染图片预览 */}
            {(() => {
              const anyParts = parts as unknown as { type: string; url?: string; mediaType?: string }[];
              const imageParts = anyParts.filter((p) => p && p.type === "file" && p.mediaType?.startsWith("image/"));
              if (imageParts.length > 0) {
                return (
                  <div className="flex flex-wrap gap-2 justify-end max-w-full">
                    {imageParts.map((part, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden border border-border/40 shadow-sm max-w-[200px] max-h-[150px] bg-foreground/[0.02]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={part.url}
                          alt="Uploaded media"
                          className="w-full h-full object-cover max-w-[200px] max-h-[150px]"
                        />
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
            {/* 用户文本消息：灰色气泡 */}
            {fullText && (
              <div className="inline-block rounded-2xl rounded-tr-md bg-message-user-bg px-4 py-2.5 text-message-user-text">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{fullText}</p>
              </div>
            )}
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
            {fullText && <Markdown content={fullText} messageId={message.id} onConfirmProposal={onConfirmProposal} />}
          </div>
        )}
      </div>
    </div>
  );
}
