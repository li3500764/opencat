// ============================================================
// 侧边栏组件（客户端）
// ============================================================
// 功能：
// 1. 新建对话按钮
// 2. 对话列表（Zustand 管理状态）
// 3. 当前对话高亮
// 4. 删除对话
// 5. 底部：主题切换 + 用户信息 + 登出
//
// 样式参考 Evose：浅灰底侧边栏、微妙 hover、干净分割线

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { Plus, MessageSquare, Trash2, Loader2, LogOut, Settings, Key } from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    conversations,
    isLoading,
    activeConversationId,
    fetchConversations,
    setActiveConversationId,
    removeConversation,
  } = useChatStore();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const match = pathname.match(/\/chat\/(.+)/);
    if (match) {
      setActiveConversationId(match[1]);
    } else if (pathname === "/chat") {
      setActiveConversationId(null);
    }
  }, [pathname, setActiveConversationId]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    router.push("/chat");
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    router.push(`/chat/${id}`);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeConversation(id);
    if (activeConversationId === id) {
      router.push("/chat");
    }
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background-secondary">
      {/* Logo + 新建对话 */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">OpenCat</span>
          <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            beta
          </span>
        </div>
        <button
          onClick={handleNewChat}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-foreground"
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* 对话列表 */}
      <nav className="flex-1 overflow-y-auto p-2">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-[var(--sidebar-active)] font-medium text-foreground"
                    : "text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="hidden shrink-0 rounded p-0.5 text-muted/60 transition-colors hover:text-danger group-hover:block"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* 底部操作栏 */}
      <div className="border-t border-border p-3">
        {/* 工具行：主题切换 + Settings */}
        <div className="mb-2 flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => router.push("/settings")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-foreground"
            title="API Keys"
          >
            <Key className="h-4 w-4" />
          </button>
        </div>

        {/* 用户信息 */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-xs font-medium">
              {user.name || user.email}
            </p>
            <p className="truncate text-[10px] text-muted">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-danger"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
