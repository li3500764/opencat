// ============================================================
// ChatPanel — 聊天主面板（Day 5: Agent 选择器）
// ============================================================
//
// Day 5 升级：
// 1. 新增 AgentSelector，可选择使用哪个 Agent
// 2. 将 agentId 传给 Chat API，由后端加载 Agent 配置
// 3. 选择 Agent 后，模型自动跟随 Agent 的配置
// ============================================================

"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { AgentSelector } from "./agent-selector";
import { useChatStore } from "@/stores/chat";
import { Cat } from "lucide-react";

interface ChatPanelProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
}

export function ChatPanel({ conversationId: initialConvId, initialMessages }: ChatPanelProps) {
  // ---- 对话和模型状态 ----
  const [conversationId, setConversationId] = useState<string | null>(initialConvId ?? null);
  const conversationIdRef = useRef(conversationId);
  const [modelId, setModelId] = useState("gpt-5.4-mini");
  const modelIdRef = useRef(modelId);

  // ---- ★ Day 5 新增：Agent 状态 ----
  // agentId 为 null 表示不使用 Agent（普通聊天模式）
  // 选择 Agent 后，Chat API 会加载 Agent 的配置（system prompt、tools、model 等）
  const [agentId, setAgentId] = useState<string | null>(null);
  const agentIdRef = useRef(agentId);

  const { fetchConversations, setActiveConversationId } = useChatStore();

  // ---- 保持 ref 同步 ----
  // 为什么用 ref？
  // → transport 的 body 是在创建时定义的函数
  // → 如果直接用 state，body 函数会闭包捕获旧值
  // → 用 ref 可以在 body 函数执行时获取最新值
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { modelIdRef.current = modelId; }, [modelId]);
  useEffect(() => { agentIdRef.current = agentId; }, [agentId]);

  // ---- Transport 配置 ----
  // DefaultChatTransport 负责把消息发送到 /api/chat
  // body 函数会在每次发消息时调用，返回额外的请求参数
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: conversationIdRef.current,
          modelId: modelIdRef.current,
          // ★ Day 5 新增：传入 agentId
          // 如果不为 null，后端会加载 Agent 的配置来处理消息
          agentId: agentIdRef.current,
        }),
        // 自定义 fetch：从响应头中获取新创建的 conversationId
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

  // ---- useChat Hook ----
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
      {/* 顶栏：Agent 选择器 + 模型选择器 */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        {/* ★ Day 5 新增：Agent 选择器 */}
        <AgentSelector value={agentId} onChange={setAgentId} />

        {/* 分隔点 */}
        <span className="text-muted/30">·</span>

        {/* 模型选择器（Agent 模式下仍可手动覆盖模型） */}
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
