// ============================================================
// Chat 页面 — 已有对话（AI SDK 6.x）
// ============================================================
// /chat/[id] → 加载历史消息继续对话
// 从 DB 加载的消息需要转成 UIMessage 格式（带 parts 数组）

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Cat, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";

// DB 消息格式 → UIMessage 格式
interface DbMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

function toUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }));
}

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const [messages, setMessages] = useState<UIMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(`/api/conversations/${id}/messages`);
        if (!res.ok) {
          setError(res.status === 404 ? "Conversation not found" : "Failed to load");
          return;
        }
        const data: DbMessage[] = await res.json();
        setMessages(toUIMessages(data));
      } catch {
        setError("Failed to load conversation");
      }
    }
    loadMessages();
  }, [id]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Cat className="mx-auto h-10 w-10 text-muted/40" />
          <p className="mt-3 text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!messages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  return <ChatPanel conversationId={id} initialMessages={messages} />;
}
