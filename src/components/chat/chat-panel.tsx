// ============================================================
// ChatPanel — 聊天主面板（Day 3: 模型选择器）
// ============================================================

"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { useChatStore } from "@/stores/chat";
import { Cat } from "lucide-react";

interface ChatPanelProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
}

export function ChatPanel({ conversationId: initialConvId, initialMessages }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConvId ?? null);
  const conversationIdRef = useRef(conversationId);
  const [modelId, setModelId] = useState("gpt-4o");
  const modelIdRef = useRef(modelId);
  const { fetchConversations, setActiveConversationId } = useChatStore();

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { modelIdRef.current = modelId; }, [modelId]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: conversationIdRef.current,
          modelId: modelIdRef.current,
        }),
        fetch: async (url, options) => {
          const response = await fetch(url as string, options as RequestInit);
          const newConvId = response.headers.get("X-Conversation-Id");
          if (newConvId && newConvId !== conversationIdRef.current) {
            setConversationId(newConvId);
            setActiveConversationId(newConvId);
            fetchConversations();
          }
          return response;
        },
      })
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => { fetchConversations(); },
  });

  const isActive = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (conversationId) setActiveConversationId(conversationId);
  }, [conversationId, setActiveConversationId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isActive) return;
      await sendMessage({ text });
    },
    [sendMessage, isActive]
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏：模型选择器 */}
      <div className="flex h-12 items-center border-b border-border px-4">
        <ModelSelector value={modelId} onChange={setModelId} />
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.04]">
            <Cat className="h-6 w-6 text-muted" />
          </div>
          <h2 className="text-lg font-medium">我能为你做什么？</h2>
        </div>
      ) : (
        <MessageList messages={messages} isStreaming={isActive} />
      )}

      <ChatInput isLoading={isActive} onSend={handleSend} onStop={stop} />
    </div>
  );
}
