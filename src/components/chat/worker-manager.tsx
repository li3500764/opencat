// ============================================================
// Shadow Chat Workers — 影子常驻流工作线程管理器
// ============================================================
// 功能：
// 1. 全局布局中后台常驻，不随路由卸载而中断聊天流。
// 2. 提供单例与多会话影子流控连接。
// 3. 将流式打字与控制权以极快速度同步到 Zustand store，实现后台接收。
// 4. 传输完毕且用户不在该对话页面时，影子线程自发安全销毁释放资源。

"use client";

import { useEffect, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChatStore, type ChatWorkerState, type PendingWorkerConfig } from "@/stores/chat";

// ============================================================
// ChatWorkerManager — 影子线程管理器
// ============================================================
export function ChatWorkerManager() {
  const activeWorkers = useChatStore((state) => state.activeWorkers);
  const pendingWorkers = useChatStore((state) => state.pendingWorkers);

  // 影子线程池中包含：待挂载的 pending workers 和 已经在工作的 active workers
  const workerIds = Array.from(
    new Set([...Object.keys(pendingWorkers), ...Object.keys(activeWorkers)])
  );

  return (
    <div className="hidden pointer-events-none" aria-hidden="true" style={{ display: "none" }}>
      {workerIds.map((id) => (
        <ChatWorker key={id} workerId={id} />
      ))}
    </div>
  );
}

// ============================================================
// ChatWorker — 单个影子工作线程组件
// ============================================================
interface ChatWorkerProps {
  workerId: string;
}

function ChatWorker({ workerId }: ChatWorkerProps) {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const pendingWorker = useChatStore((state) => state.pendingWorkers[workerId]);
  const activeWorker = useChatStore((state) => state.activeWorkers[workerId]);
  
  const registerWorker = useChatStore((state) => state.registerWorker);
  const updateWorkerState = useChatStore((state) => state.updateWorkerState);
  const unregisterWorker = useChatStore((state) => state.unregisterWorker);
  const migrateWorker = useChatStore((state) => state.migrateWorker);
  const clearPendingWorker = useChatStore((state) => state.clearPendingWorker);
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  // 核心参数多层容错读取
  const modelId = pendingWorker?.modelId || activeWorker?.modelId || "";
  const agentId = pendingWorker !== undefined ? pendingWorker.agentId : (activeWorker?.agentId ?? null);
  const initialMessages = pendingWorker?.initialMessages || activeWorker?.messages || [];

  const conversationIdRef = useRef(workerId);
  const modelIdRef = useRef(modelId);
  const agentIdRef = useRef(agentId);

  // 同步 refs，确保 fetch 闭包始终获取最新配置
  useEffect(() => { conversationIdRef.current = workerId; }, [workerId]);
  useEffect(() => { modelIdRef.current = modelId; }, [modelId]);
  useEffect(() => { agentIdRef.current = agentId; }, [agentId]);

  // ---- 1. 自定义 Transport 流连接配置 ----
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          // 若为新建会话占位 ID "new-chat"，则发送给后端为 null 从而触发新建会话
          conversationId: conversationIdRef.current === "new-chat" ? null : conversationIdRef.current,
          modelId: modelIdRef.current,
          agentId: agentIdRef.current,
        }),
        fetch: async (url, options) => {
          const response = await fetch(url as string, options as RequestInit);
          const newConvId = response.headers.get("X-Conversation-Id");
          
          if (newConvId && newConvId !== conversationIdRef.current) {
            const oldId = conversationIdRef.current;
            conversationIdRef.current = newConvId;

            // 1. 将影子 Worker 在 Zustand 状态中瞬间由临时占位符迁移为正式会话 ID
            migrateWorker(oldId, newConvId);

            // 2. 将侧边栏高亮及会话列表重载触发同步更新
            setActiveConversationId(newConvId);
            fetchConversations();

            // 3. 同步转移新建会话时提前调整的模型持久化和 Emoji 头像记忆
            const lastNewChatModel = localStorage.getItem("last_selected_model_new_chat");
            if (lastNewChatModel) {
              localStorage.setItem("chat_model_" + newConvId, lastNewChatModel);
            }
          }
          return response;
        },
      })
  );

  // ---- 2. 调用 AI SDK 的 useChat Hook ----
  const { messages, sendMessage, status, stop } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      fetchConversations();
    },
  });

  // ---- 3. 初始化与首次挂载时的消息提交指令 ----
  useEffect(() => {
    if (pendingWorker && pendingWorker.textToSubmit) {
      const text = pendingWorker.textToSubmit;
      
      // 清空 pending 状态，标志此影子线程已成功挂载入编
      clearPendingWorker(workerId);

      // 第一时间向全局 Zustand 注册自己，使前台立即可以侦测并绑定该 Worker 的控制权
      registerWorker(workerId, {
        conversationId: workerId,
        messages,
        status: "submitted",
        modelId,
        agentId,
        sendMessage,
        stop,
      });

      // 触发 AI SDK 消息流式接收
      sendMessage({ text });
    } else if (!activeWorker) {
      // 如果属于刷新、重新挂载或者从历史记录恢复的空闲 Worker，也需要进行注册
      registerWorker(workerId, {
        conversationId: workerId,
        messages,
        status,
        modelId,
        agentId,
        sendMessage,
        stop,
      });
    }
  }, []);

  // ---- 4. 增量实时向全局 Zustand 同步消息流及 status 变化 ----
  useEffect(() => {
    // 只有在已注册成为活跃工作线程时，才持续增量同步状态
    if (activeWorker) {
      updateWorkerState(workerId, messages, status);
    }
  }, [messages, status, workerId]);

  // ---- 5. 自动回收机制 (影子线程智能销毁与垃圾回收) ----
  useEffect(() => {
    // 满足以下两个条件时可触发自我安全销毁：
    // (a) 当前流接收完毕 (状态为 idle)
    // (b) 当前影子线程所服务的会话退居后台，用户并未停留在当前对话中
    if (status === "idle" && activeConversationId !== workerId) {
      unregisterWorker(workerId);
    }
  }, [status, activeConversationId, workerId, unregisterWorker]);

  return null;
}
