// ============================================================
// 单条消息组件（AI SDK 6.x）
// ============================================================
// 样式参考 Evose：
// - 用户消息：浅灰圆角气泡（light）/ 深色气泡（dark），不用琥珀色
// - AI 消息：无背景，直接渲染 Markdown
// - 头像：小圆形，带首字母或猫 icon

"use client";

import { Cat, User } from "lucide-react";
import { Markdown } from "./markdown";
import type { UIMessage } from "ai";

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = getTextContent(message);

  if (!text) return null;

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
          {isUser ? "You" : "OpenCat"}
        </p>

        {/* 消息体 */}
        {isUser ? (
          <div className="inline-block rounded-2xl rounded-tr-md bg-message-user-bg px-4 py-2.5 text-message-user-text">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md">
            <Markdown content={text} />
          </div>
        )}
      </div>
    </div>
  );
}
