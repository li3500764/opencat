// ============================================================
// Chat 页面 — 已有对话（AI SDK 6.x）
// ============================================================
// /chat/[id] → 加载历史消息继续对话
// 从 DB 加载的消息需要转成 UIMessage 格式（带 parts 数组）
// ★ 同时加载 agentId 和 lastModel，恢复选择器状态

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useChatStore } from "@/stores/chat";
import { Cat, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";

// DB 消息格式 → UIMessage 格式
interface DbMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

function toUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
      createdAt: new Date(m.createdAt),
    } as unknown as UIMessage));
}

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  // 1. 读取全局活跃影子 Worker
  const activeWorker = useChatStore((state) => state.activeWorkers[id]);

  // 2. 如果存在活跃影子线程（刚刚创建会话并迁移过来的），静默初始化状态，避免菊花图闪烁
  const [messages, setMessages] = useState<UIMessage[] | null>(() => {
    if (activeWorker) {
      return activeWorker.messages;
    }
    return null;
  });
  const [agentId, setAgentId] = useState<string | null>(() => {
    if (activeWorker) {
      return activeWorker.agentId;
    }
    return null;
  });
  const [lastModel, setLastModel] = useState<string | null>(() => {
    if (activeWorker) {
      return activeWorker.modelId;
    }
    return null;
  });
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(`/api/conversations/${id}/messages`);
        if (!res.ok) {
          // 如果有活跃影子线程，API 偶尔加载失败也不抛错崩溃，由活跃线程自愈
          if (!activeWorker) {
            setError(res.status === 404 ? "Conversation not found" : "Failed to load");
          }
          return;
        }
        const data = await res.json();
        // API 现在返回 { messages, agentId, lastModel, metadata }
        setMessages(toUIMessages(data.messages));
        setAgentId(data.agentId || null);
        setLastModel(data.lastModel || null);
        setMetadata(data.metadata || {});
      } catch {
        if (!activeWorker) {
          setError("Failed to load conversation");
        }
      }
    }
    loadMessages();
  }, [id, activeWorker]);

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
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      </div>
    );
  }

  return (
    <ChatPanel
      conversationId={id}
      initialMessages={messages}
      initialAgentId={agentId}
      initialModelId={lastModel}
      initialMetadata={metadata}
    />
  );
}
