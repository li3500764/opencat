// ============================================================
// Chat 页面 — 新对话 (重构联动版)
// ============================================================
// /chat 路由 → 空白对话页面，发第一条消息后自动建对话。
// 支持从 URL 查询参数 `?agentId=xxx` 自动挂载指定的智能体。
//
// ============================================================

"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Loader2 } from "lucide-react";

function ChatWithSearchParams() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agentId");

  return <ChatPanel initialAgentId={agentId} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    }>
      <ChatWithSearchParams />
    </Suspense>
  );
}
