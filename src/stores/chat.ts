// ============================================================
// Chat Store（Zustand）
// ============================================================
// 管理侧边栏的对话列表状态以及全局后台影子工作线程
//
// 职责分工：
// - Zustand → 对话列表、当前选中对话 ID、后台流连接托管 (Shadow Workers)
// - useChat → 影子线程内部运行，通过 Zustand 向前台同步流式内容与控制方法

import { create } from "zustand";
import type { UIMessage } from "ai";

export interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

// 活跃影子工作线程状态与动作
export interface ChatWorkerState {
  conversationId: string;
  messages: UIMessage[];
  status: "idle" | "streaming" | "submitted";
  modelId: string;
  agentId: string | null;
  // 全局控制句柄，支持对象格式以传输 parts
  sendMessage: (args: { text?: string; parts?: unknown[] }) => Promise<void>;
  stop: () => void;
}

// 待启动影子线程配置
export interface PendingWorkerConfig {
  conversationId: string;
  modelId: string;
  agentId: string | null;
  initialMessages: UIMessage[];
  textToSubmit?: string;
  partsToSubmit?: unknown[]; // 新增支持 parts 提交
}

interface ChatState {
  // 对话列表
  conversations: ConversationItem[];
  isLoading: boolean;

  // 当前对话
  activeConversationId: string | null;

  // 活跃影子 Worker 注册表
  activeWorkers: Record<string, ChatWorkerState>;
  // 待启动影子 Worker 队列
  pendingWorkers: Record<string, PendingWorkerConfig>;

  // Actions
  setActiveConversationId: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  addConversation: (conv: ConversationItem) => void;

  // Worker Actions
  startWorker: (id: string, config: Omit<PendingWorkerConfig, "conversationId">) => void;
  clearPendingWorker: (id: string) => void;
  registerWorker: (id: string, worker: ChatWorkerState) => void;
  updateWorkerState: (id: string, messages: UIMessage[], status: ChatWorkerState["status"]) => void;
  unregisterWorker: (id: string) => void;
  migrateWorker: (oldId: string, newId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  isLoading: false,
  activeConversationId: null,

  activeWorkers: {},
  pendingWorkers: {},

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
        // 注销已删除对话关联的影子线程
        get().unregisterWorker(id);
        
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

  // ---- 影子 Worker 相关 Actions ----
  
  startWorker: (id, config) => {
    set((state) => ({
      pendingWorkers: {
        ...state.pendingWorkers,
        [id]: { ...config, conversationId: id },
      },
    }));
  },

  clearPendingWorker: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.pendingWorkers;
      return { pendingWorkers: rest };
    });
  },

  registerWorker: (id, worker) => {
    set((state) => ({
      activeWorkers: {
        ...state.activeWorkers,
        [id]: worker,
      },
    }));
  },

  updateWorkerState: (id, messages, status) => {
    set((state) => {
      const existing = state.activeWorkers[id];
      if (!existing) return {};
      return {
        activeWorkers: {
          ...state.activeWorkers,
          [id]: {
            ...existing,
            messages,
            status,
          },
        },
      };
    });
  },

  unregisterWorker: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.activeWorkers;
      return { activeWorkers: rest };
    });
  },

  migrateWorker: (oldId, newId) => {
    set((state) => {
      const worker = state.activeWorkers[oldId];
      if (!worker) return {};
      const { [oldId]: _, ...rest } = state.activeWorkers;
      return {
        activeWorkers: {
          ...rest,
          [newId]: { ...worker, conversationId: newId },
        },
      };
    });
  },
}));
