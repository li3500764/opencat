// ============================================================
// 聊天输入框组件（AI SDK 6.x）
// ============================================================
// 样式参考 Evose：圆角输入框 + 微妙投影 + 干净边框
// Enter 发送，Shift+Enter 换行

"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatInput({ isLoading, onSend, onStop }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {/* 输入框容器 —— Evose 风格：白底/深色底 + 微妙投影 + 圆角 */}
        <div
          className="flex items-end gap-2 rounded-2xl border border-border bg-input-bg px-4 py-3 transition-all focus-within:border-accent/40"
          style={{ boxShadow: "var(--input-shadow)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted/50"
            disabled={isLoading}
          />

          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90"
              title="Stop generating"
            >
              <Square className="h-3 w-3" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:opacity-80 disabled:opacity-20 disabled:cursor-not-allowed"
              title="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted/40">
          OpenCat may make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
