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
import { useRouter, usePathname } from "next/navigation";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { AgentSelector } from "./agent-selector";
import { useChatStore } from "@/stores/chat";
import { Cat, Brain, Sparkles, Check, Edit2, Loader2, Globe, MessageSquare, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { UserMemoryDrawer } from "./user-memory-drawer";

// ---- 长期记忆 Toast 结构 ----
interface PendingMemoryToast {
  id: string;
  content: string;
  category: string;
  conversationId: string | null;
  importance: number;
}

interface ChatPanelProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
  initialAgentId?: string | null;   // ★ 恢复 Agent 选择状态
  initialModelId?: string | null;   // ★ 恢复模型选择状态
  initialMetadata?: any;            // ★ 会话元数据（包含 Emoji 头像）
}

export function ChatPanel({ conversationId: initialConvId, initialMessages, initialAgentId, initialModelId, initialMetadata }: ChatPanelProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ---- 对话和模型状态 ----
  const [conversationId, setConversationId] = useState<string | null>(initialConvId ?? null);
  const conversationIdRef = useRef(conversationId);
  const [modelId, setModelId] = useState(initialModelId || "");
  const modelIdRef = useRef(modelId);

  // ---- 会话专属元数据和头像弹窗状态 ----
  const [metadata, setMetadata] = useState<any>(initialMetadata ?? {});
  const metadataRef = useRef(metadata);
  const [avatarModalOpen, setAvatarModalOpen] = useState<"user" | "ai" | null>(null);
  
  // ---- 记忆抽屉显示状态 ----
  const [memoryOpen, setMemoryOpen] = useState(false);
  
  // ---- 右上角待确认记忆弹窗状态 ----
  const [pendingToast, setPendingToast] = useState<PendingMemoryToast | null>(null);
  const notifiedToolCalls = useRef<Set<string>>(new Set());

  useEffect(() => { metadataRef.current = metadata; }, [metadata]);
  useEffect(() => { if (initialMetadata) setMetadata(initialMetadata); }, [initialMetadata]);

  // ---- ★ Day 5 新增：Agent 状态 ----
  // agentId 为 null 表示不使用 Agent（普通聊天模式）
  // 选择 Agent 后，Chat API 会加载 Agent 的配置（system prompt、tools、model 等）
  const [agentId, setAgentId] = useState<string | null>(initialAgentId ?? null);
  const agentIdRef = useRef(agentId);

  const { fetchConversations, setActiveConversationId } = useChatStore();
  const { t } = useTranslation();

  // ---- 智能初始化大模型选择逻辑（大模型动态记忆与自适应首选） ----
  useEffect(() => {
    async function initModelSelection() {
      // 1. 如果 initialModelId 已经有历史选定值，优先恢复历史状态
      if (initialModelId) {
        setModelId(initialModelId);
        return;
      }


      // 2. 如果当前有 conversationId，尝试从 LocalStorage 中读取该对话的专属切换记忆
      if (conversationId) {
        const cached = localStorage.getItem("chat_model_" + conversationId);
        if (cached) {
          setModelId(cached);
          return;
        }
      }

      // 3. 否则，动态拉取可用模型列表，优先以用户配置的第一个模型作为默认激活值
      try {
        const res = await fetch("/api/models");
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const firstModelId = data[0].id;
            setModelId(firstModelId);
            // 如果是新对话（还没有 conversationId），先记录在临时新建缓存中
            if (!conversationId) {
              localStorage.setItem("last_selected_model_new_chat", firstModelId);
            }
          } else {
            // 如果确实没配密钥，置为空，模型选择器头部将优雅呈现“未配置模型”
            setModelId("");
          }
        }
      } catch (err) {
        console.error("加载可用模型列表并初始化默认选择失败:", err);
      }
    }

    initModelSelection();
  }, [conversationId, initialModelId]);

  // ---- 切换模型动作（支持LocalStorage持久会话记忆） ----
  const handleModelChange = useCallback((newModelId: string) => {
    setModelId(newModelId);
    if (conversationId) {
      localStorage.setItem("chat_model_" + conversationId, newModelId);
    } else {
      localStorage.setItem("last_selected_model_new_chat", newModelId);
    }
  }, [conversationId]);

  // ---- 动态更新 Emoji 头像动作（支持持久化与秒级回写） ----
  const handleUpdateAvatar = useCallback(async (type: "user" | "ai", emoji: string) => {
    const key = type === "user" ? "userAvatar" : "aiAvatar";
    const newMeta = { ...metadata, [key]: emoji };
    setMetadata(newMeta);
    setAvatarModalOpen(null);

    // 如果当前处于已有会话中，立刻触发后端 PATCH 请求进行持久化
    if (conversationId) {
      try {
        await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            metadata: { [key]: emoji },
          }),
        });
      } catch (err) {
        console.error("更新对话 Emoji 头像失败:", err);
      }
    }
  }, [conversationId, metadata]);

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
            
            // ★ 新建对话发送成功后，瞬间将刚才临时的模型记忆转移到新生成的 ConversationId 下！
            const lastNewChatModel = localStorage.getItem("last_selected_model_new_chat");
            if (lastNewChatModel) {
              localStorage.setItem("chat_model_" + newConvId, lastNewChatModel);
            }

            // ★ 瞬间将新建会话时提前修改的 Emoji 头像 metadata 提交 PATCH 持久化保存至后端！
            if (metadataRef.current && (metadataRef.current.userAvatar || metadataRef.current.aiAvatar)) {
              try {
                await fetch("/api/conversations", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    conversationId: newConvId,
                    metadata: metadataRef.current,
                  }),
                });
              } catch (e) {
                console.error("新建会话延时持久化头像失败:", e);
              }
            }
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

  // 当在新对话发送消息生成 conversationId 时，自动将路由更新为当前对话的详细路由
  // 从而使得侧边栏的“新开 chat”按钮（即跳转到 /chat）能够正常触发页面重载与状态重置
  useEffect(() => {
    if (conversationId && pathname === "/chat") {
      router.replace(`/chat/${conversationId}`);
    }
  }, [conversationId, pathname, router]);

  // 监听并拦截 AI SDK 流式返回的工具调用结果包 (扫描自定义 parts 数组)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1] as any;
    if (lastMessage && lastMessage.parts) {
      lastMessage.parts.forEach((part: any) => {
        // 判断是否是 memory_save 工具调用，且已经执行完毕
        const isMemorySave = (part.type === "dynamic-tool" && part.toolName === "memory_save") ||
                             (part.type && part.type === "tool-memory_save") ||
                             (part.type && part.type.startsWith("tool-memory_save"));

        if (isMemorySave && part.state === "output-available" && part.output) {
          const outputData = part.output;
          // 容错取值：兼容 part.output.data 或直接 part.output
          const resultData = outputData?.data || outputData;
          const toolCallId = part.toolCallId || "memory_save_call";

          // 如果后端返回了 pending: true，且该 toolCallId 我们之前没有弹过，立刻捕获
          if (resultData && resultData.pending && !notifiedToolCalls.current.has(toolCallId)) {
            notifiedToolCalls.current.add(toolCallId);
            setPendingToast({
              id: toolCallId,
              content: resultData.content,
              category: resultData.category,
              conversationId: resultData.conversationId,
              importance: resultData.importance || 0.8,
            });
          }
        }
      });
    }
  }, [messages, memoryOpen]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isActive) return;
      await sendMessage({ text });
    },
    [sendMessage, isActive]
  );

  return (
    <div className="flex h-full w-full flex-row bg-background overflow-hidden relative">
      {/* 左侧聊天主面板 (支持大屏开启抽屉时优雅向左平移 400px) */}
      <div className={`flex flex-1 flex-col h-full min-w-0 bg-background transition-all duration-300 ease-out
        ${memoryOpen ? "lg:mr-[400px]" : "mr-0"}
      `}>
        {/* 顶栏：Agent 选择器 + 模型选择器 + 右侧记忆图标 */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {/* ★ Day 5 新增：Agent 选择器 */}
            <AgentSelector value={agentId} onChange={setAgentId} />

            {/* 分隔点 */}
            <span className="text-muted/30">·</span>

            {/* 模型选择器 */}
            <ModelSelector value={modelId} onChange={handleModelChange} />
          </div>

          {/* 右侧：“关于你”长期记忆激活按钮 */}
          <button
            onClick={() => setMemoryOpen(!memoryOpen)}
            title="关于你 — 长期记忆"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-[0.9] border
              ${memoryOpen 
                ? "bg-[#D4A373]/10 text-[#D4A373] border-[#D4A373]/25" 
                : "text-muted hover:bg-foreground/[0.04] hover:text-foreground border-transparent"
              }
            `}
          >
            <Brain className="h-4.5 w-4.5" />
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.04]">
              <Cat className="h-6 w-6 text-muted" />
            </div>
            <h2 className="text-lg font-medium">{t('chat.welcomeMessage')}</h2>
          </div>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isActive}
            userAvatar={metadata?.userAvatar || "🧑‍💻"}
            aiAvatar={metadata?.aiAvatar || "🤖"}
            onAvatarClick={(type) => setAvatarModalOpen(type)}
          />
        )}

        <ChatInput isLoading={isActive} onSend={handleSend} onStop={stop} />

        {/* 极富 Premium 磨砂美感的 Emoji 头像修改悬浮模态弹窗 */}
        {avatarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm animate-fadeIn">
            <div className="w-80 rounded-2xl border border-border/80 bg-card p-5 shadow-2xl animate-scaleIn border-t-foreground/10"
              style={{ boxShadow: "var(--input-shadow), 0 10px 40px rgba(0,0,0,0.12)" }}
            >
              <h3 className="text-sm font-semibold text-foreground">
                修改{avatarModalOpen === "user" ? "用户" : "AI助手"}专属头像
              </h3>
              <p className="text-[10px] text-muted mt-0.5 mb-4">头像仅保存在当前对话中，多会话彼此隔离</p>

              <div className="grid grid-cols-5 gap-2">
                {(avatarModalOpen === "user" 
                  ? ["🧑‍💻", "🧑‍🚀", "🧑‍🎨", "🧑‍🍳", "🦊", "🐼", "🐰", "👻", "🌟", "🔥"]
                  : ["🤖", "🐱", "🦁", "🦉", "🦊", "🧠", "🛸", "🚀", "💎", "👑"]
                ).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleUpdateAvatar(avatarModalOpen, emoji)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.03] text-2xl hover:bg-foreground/[0.08] active:scale-[0.92] hover:scale-[1.05] transition-all hover:rotate-3"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setAvatarModalOpen(null)}
                className="mt-5 w-full rounded-xl bg-foreground/[0.05] py-2 text-xs font-medium text-foreground hover:bg-foreground/[0.08] active:scale-[0.98] transition-colors"
              >
                取消修改
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：“关于你”长期记忆抽屉组件 */}
      <UserMemoryDrawer
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        conversationId={conversationId}
      />

      {/* 右上角：“关于你”记忆自主拦截 Toast 通知（倒计时 + 便捷编辑 + 忽视） */}
      {pendingToast && (
        <MemoryConfirmToast
          toastData={pendingToast}
          onClose={() => setPendingToast(null)}
          onSaved={() => {
            // 保存成功后，如果抽屉开着，顺便刷新抽屉内容
            if (memoryOpen) {
              // 触发抽屉热更新（抽屉内部通过 isOpen 触发，关闭后重开可更新）
              setMemoryOpen(false);
              setTimeout(() => setMemoryOpen(true), 50);
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// MemoryConfirmToast — 右上角记忆交互弹窗（倒计时 10s、便捷修改与忽略）
// ============================================================
function MemoryConfirmToast({
  toastData,
  onClose,
  onSaved,
}: {
  toastData: PendingMemoryToast;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(toastData.content);
  const [scope, setScope] = useState<"global" | "conversation">("global");
  const [progress, setProgress] = useState(100);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSavedTip, setAutoSavedTip] = useState(false);

  // 10s 倒计时进度条逻辑 (正在编辑/正在保存时不倒计时)
  useEffect(() => {
    if (isEditing || isSaving || autoSavedTip) return;

    const intervalMs = 100;
    const totalMs = 10000;
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += intervalMs;
      const percentLeft = Math.max(0, 100 - (elapsedMs / totalMs) * 100);
      const secondsLeft = Math.max(0, 10 - elapsedMs / 1000);

      setProgress(percentLeft);
      setTimeLeft(secondsLeft);

      if (elapsedMs >= totalMs) {
        clearInterval(timer);
        // 时间走完，自动确认保存！
        handleSave(true);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isEditing, isSaving, autoSavedTip]);

  // 保存落库
  const handleSave = async (isAuto = false) => {
    try {
      setIsSaving(true);
      if (isAuto) {
        setAutoSavedTip(true);
      }
      
      const finalContent = isEditing ? editText : toastData.content;

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: finalContent,
          category: toastData.category,
          conversationId: scope === "conversation" ? toastData.conversationId : null,
        }),
      });

      if (res.ok) {
        if (isAuto) {
          // 自动确认时多给用户 1.5 秒视觉反馈，体验极佳
          setTimeout(() => {
            onSaved();
            onClose();
          }, 1500);
        } else {
          onSaved();
          onClose();
        }
      } else {
        onClose();
      }
    } catch (err) {
      console.error("记忆确认落库失败:", err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // 分类中文翻译映射
  const categoryLabels: Record<string, string> = {
    preference: "偏好",
    background: "背景",
    behavior: "行为",
    workflow: "工作流",
  };

  return (
    <div 
      className="fixed top-5 right-5 z-[100] w-96 rounded-2xl border border-[#D4A373]/30 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden p-4 animate-slideInRight"
      style={{
        boxShadow: "0 20px 50px rgba(0,0,0,0.18), inset 0 1px 0 rgba(212,163,89,0.12)"
      }}
    >
      {/* 头部装饰与分类 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-foreground">
          <Sparkles className="h-4 w-4 text-[#D4A373] animate-pulse" />
          <span className="text-xs font-semibold text-foreground">
            AI 准备沉淀记忆
          </span>
          <span className="inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-medium bg-[#D4A373]/10 text-[#D4A373] border border-[#D4A373]/15">
            {categoryLabels[toastData.category] || "分析"}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-muted hover:text-foreground hover:bg-foreground/[0.04] p-1 rounded-md transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 记忆文本与编辑区 */}
      <div className="mb-3.5 text-xs text-foreground/90 pl-0.5">
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full min-h-[50px] rounded-lg border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder-muted focus:border-foreground/30 focus:outline-none resize-none transition-colors"
          />
        ) : (
          <p className="leading-relaxed break-words font-medium">
            “{toastData.content}”
          </p>
        )}
      </div>

      {/* 范围选择与操作区域 */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        {/* 范围选择 (仅在非自动保存状态显示) */}
        {autoSavedTip ? (
          <span className="text-[10px] text-[#D4A373] font-medium animate-pulse flex items-center gap-1">
            <Check className="h-3 w-3" /> 已自动确认并保存...
          </span>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => setScope("global")}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] border transition-all
                ${scope === "global" 
                  ? "bg-[#D4A373]/10 border-[#D4A373]/25 text-[#D4A373]" 
                  : "bg-transparent border-transparent text-muted hover:text-foreground"
                }
              `}
            >
              <Globe className="h-2.5 w-2.5" /> 全局
            </button>
            {toastData.conversationId && (
              <button
                onClick={() => setScope("conversation")}
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] border transition-all
                  ${scope === "conversation" 
                    ? "bg-[#D4A373]/10 border-[#D4A373]/25 text-[#D4A373]" 
                    : "bg-transparent border-transparent text-muted hover:text-foreground"
                  }
                `}
              >
                <MessageSquare className="h-2.5 w-2.5" /> 仅本对话
              </button>
            )}
          </div>
        )}

        {/* 按钮群组 */}
        {!autoSavedTip && (
          <div className="flex gap-1.5 shrink-0">
            {/* 忽略按钮 */}
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-lg text-[10px] text-muted hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
            >
              忽略
            </button>

            {/* 便捷修改按钮 */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] text-muted hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
              >
                <Edit2 className="h-2.5 w-2.5" /> 修改
              </button>
            )}

            {/* 确认保存按钮 */}
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving || (isEditing && !editText.trim())}
              className="flex items-center gap-1 rounded-lg bg-foreground px-3 py-1 text-[10px] font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-all active:scale-[0.96]"
            >
              {isSaving && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {isEditing ? "保存" : `确认 (${Math.ceil(timeLeft)}s)`}
            </button>
          </div>
        )}
      </div>

      {/* 倒计时金色细度进度条 (只有在非编辑状态才渲染) */}
      {!isEditing && !isSaving && !autoSavedTip && (
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-foreground/[0.03]">
          <div 
            className="h-full bg-gradient-to-r from-[#C2956E] to-[#D4A373] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

