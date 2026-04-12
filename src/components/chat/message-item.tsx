// ============================================================
// 单条消息组件（AI SDK 6.x）
// ============================================================
// UIMessage.parts 是内容数组：[{ type: 'text', text: '...' }, ...]
// 我们提取 text parts 拼接后渲染 Markdown

"use client";

import { Cat, User } from "lucide-react";
import { Markdown } from "./markdown";
import type { UIMessage } from "ai";

// 从 parts 里提取纯文本
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
            : "bg-foreground/5 text-muted"
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
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-accent text-white rounded-tr-md"
              : "bg-foreground/[0.03] border border-border rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
          ) : (
            <Markdown content={text} />
          )}
        </div>
      </div>
    </div>
  );
}
