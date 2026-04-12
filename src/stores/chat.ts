// ============================================================
// Chat Store（Zustand）
// ============================================================
// 管理侧边栏的对话列表状态
// 注意：单条对话的消息状态由 useChat hook 管理，不在这里
//
// 职责分工：
// - Zustand → 对话列表、当前选中的对话 ID
// - useChat → 当前对话的消息、输入框、发送/流式状态

import { create } from "zustand";

export interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ChatState {
  // 对话列表
  conversations: ConversationItem[];
  isLoading: boolean;

  // 当前对话
  activeConversationId: string | null;

  // Actions
  setActiveConversationId: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  addConversation: (conv: ConversationItem) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  isLoading: false,
  activeConversationId: null,

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data });
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  removeConversation: async (id) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
      });
      if (res.ok) {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        }));
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  },

  addConversation: (conv) => {
    set((state) => ({
      conversations: [conv, ...state.conversations],
    }));
  },
}));
