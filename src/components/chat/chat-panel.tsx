// ============================================================
// ChatPanel — 聊天主面板（AI SDK 6.x）
// ============================================================
// AI SDK 6.x useChat 的破坏性变更：
// - 没有 input / handleInputChange / handleSubmit / isLoading
// - 用 sendMessage({ text }) 发消息
// - 用 status（'ready' | 'submitted' | 'streaming' | 'error'）判状态
// - Message 类型改名为 UIMessage，内容在 parts 数组里
// - transport 替代了 api 选项
//
// 我们自己管理 input 状态（useState），然后调 sendMessage

"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { useChatStore } from "@/stores/chat";
import { Cat } from "lucide-react";

interface ChatPanelProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
}

export function ChatPanel({ conversationId: initialConvId, initialMessages }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConvId ?? null);
  const conversationIdRef = useRef(conversationId);
  const { fetchConversations, setActiveConversationId } = useChatStore();

  // 保持 ref 同步
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // 创建 transport —— 用自定义 fetch 来读取响应 header 中的 conversationId
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // body 是函数：每次请求动态读取最新 conversationId
        body: () => ({ conversationId: conversationIdRef.current }),
        // 自定义 fetch：拦截响应，从 header 读 conversationId
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

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      fetchConversations();
    },
  });

  const isActive = status === "streaming" || status === "submitted";

  // 同步 activeConversationId
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId, setActiveConversationId]);

  // 发送消息
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isActive) return;
      await sendMessage({ text });
    },
    [sendMessage, isActive]
  );

  // 新对话
  const startNewChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setActiveConversationId(null);
  }, [setMessages, setActiveConversationId]);

  return (
    <div className="flex h-full flex-col">
      {messages.length === 0 ? (
        // ---- 空状态 ----
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <Cat className="h-8 w-8 text-accent" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-medium">What can I help with?</h2>
            <p className="mt-1 text-sm text-muted">
              Start a conversation with OpenCat
            </p>
          </div>
        </div>
      ) : (
        // ---- 消息列表 ----
        <MessageList messages={messages} isStreaming={isActive} />
      )}

      {/* ---- 输入框 ---- */}
      <ChatInput
        isLoading={isActive}
        onSend={handleSend}
        onStop={stop}
      />
    </div>
  );
}
