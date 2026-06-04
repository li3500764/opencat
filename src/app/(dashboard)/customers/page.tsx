// ============================================================
// OpenCat 智能工作台 (Smart Workspace) - 重构版
// ============================================================
//
// 职责：
//   1. 将原本违和的 B2B CRM 剥离，全面升级为“智能工作台” (Smart Workspace)。
//   2. 采用三合一精美选项卡 (Tabs) 界面：
//      - Tab A: 智能体配置与调试 (Agent Console)
//      - Tab B: RAG 向量知识资产 (Knowledge Base)
//      - Tab C: 异步 AI 长时任务监控 (Autonomous Tasks)
//   3. 【智能体控制台】：一键点击“开始对话”直接挂载 URL 参数跳入 Chat 对话；支持原地编辑/新建 Agent。
//   4. 【知识资产库】：集成上传 .txt / .md 文档分块，动态语义检索的完备 RAG。
//   5. 【AI 任务监控】：设计高保真度长时后台任务列表，带有实时 terminal 风格日志诊断弹窗。
//
// ============================================================

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Bot, Database, Terminal, Plus, Search, Loader2, ArrowRight,
  ChevronDown, ChevronRight, Wrench, MessageSquare, Crown, Sparkles,
  Upload, FileText, CheckCircle2, XCircle, Clock, Trash2, Pencil,
  PlayCircle, RefreshCw, Layers
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { signOut } from "next-auth/react";

// ----------------- 类型定义 -----------------
interface AgentItem {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxSteps: number;
  tools: string[];
  isOrchestrator: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  _count: { conversations: number };
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  status: string;
  createdAt: string;
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  _count: { documents: number };
  documents: DocumentItem[];
}

interface BackgroundTask {
  id: string;
  name: string;
  type: string;
  status: "running" | "completed" | "failed";
  progress: number; // 0 - 100
  savedTime: string;
  details: string;
  logs: string[];
}



export default function SmartWorkspacePage() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";
  const router = useRouter();

  // 当前主导航 Tab
  const [activeTab, setActiveTab] = useState<"agents" | "knowledge" | "tasks">("agents");

  // ----------------- 共享状态 -----------------
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);

  // ----------------- 1. Agent 状态与逻辑 -----------------
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // ----------------- 2. 知识库状态与逻辑 -----------------
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [uploadingKbId, setUploadingKbId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------- 3. 异步任务状态与逻辑 -----------------
  const [showLogModal, setShowLogModal] = useState<BackgroundTask | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // ----------------- API 数据交互 -----------------

  const fetchDefaultProject = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/default");
      if (res.ok) {
        const data = await res.json();
        setDefaultProjectId(data.id);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await fetch("/api/agents");
      if (res.ok) setAgents(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const fetchKnowledgeBases = useCallback(async () => {
    setKbLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) setKnowledgeBases(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setKbLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaultProject();
    fetchAgents();
    fetchKnowledgeBases();
    fetchTasks();
  }, [fetchDefaultProject, fetchAgents, fetchKnowledgeBases, fetchTasks]);

  // ----------------- 实时任务 SSE 监听 -----------------
  useEffect(() => {
    // 仅当切换到 "tasks" 面板时才建立连接，避免不必要的连接开销
    if (activeTab !== "tasks") return;

    const eventSource = new EventSource("/api/tasks/stream");

    eventSource.addEventListener("task-progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        // data 格式: { taskId, userId, status, progress, log, timestamp }

        setTasks((prev) => {
          // 如果列表里还没有这个任务（比如刚新建派发的），我们先重新 fetch 整个列表以拉取最新内容
          const exists = prev.some((t) => t.id === data.taskId);
          if (!exists) {
            fetchTasks();
            return prev;
          }

          return prev.map((t) => {
            if (t.id === data.taskId) {
              const logs = [...t.logs];
              if (data.log && !logs.includes(data.log)) {
                logs.push(data.log);
              }
              return {
                ...t,
                status: data.status as any,
                progress: data.progress,
                logs,
              };
            }
            return t;
          });
        });

        // 同步更新当前正在查看的日志 Modal
        setShowLogModal((prev) => {
          if (prev && prev.id === data.taskId) {
            const logs = [...prev.logs];
            if (data.log && !logs.includes(data.log)) {
              logs.push(data.log);
            }
            return {
              ...prev,
              status: data.status as any,
              progress: data.progress,
              logs,
            };
          }
          return prev;
        });

        // 如果任务状态有变，随时重新获取知识库列表，更新 RAG 文档处理状态图标
        if (data.status === "completed" || data.status === "failed") {
          fetchKnowledgeBases();
        }

      } catch (err) {
        console.error("解析任务实时数据失败:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn("实时任务监控连接发生中断，EventSource 自动重连...");
    };

    return () => {
      eventSource.close();
    };
  }, [activeTab, fetchTasks, fetchKnowledgeBases]);

  // ----------------- Agent 业务逻辑 -----------------

  const handleDeleteAgent = async (id: string) => {
    if (!confirm(isEn ? "Are you sure to delete this Agent?" : "确定要删除该智能体吗？")) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) setAgents((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const launchAgentChat = (agentId: string) => {
    router.push(`/chat?agentId=${agentId}`);
  };

  // ----------------- 知识库业务逻辑 -----------------

  const handleDeleteKb = async (id: string) => {
    if (!confirm(isEn ? "Are you sure to delete this KB?" : "确定要删除该知识库吗？")) return;
    try {
      const res = await fetch("/api/knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
        if (expandedKbId === id) setExpandedKbId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerKbUpload = (kbId: string) => {
    setUploadingKbId(kbId);
    fileInputRef.current?.click();
  };

  const handleKbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingKbId) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md"].includes(ext || "")) {
      alert("目前只支持上传 .txt 与 .md 文本格式文档");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/knowledge/${uploadingKbId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchKnowledgeBases();
        setExpandedKbId(uploadingKbId);
      } else {
        alert("上传失败，请重试");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingKbId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ----------------- 异步任务业务逻辑 -----------------

  const handleDeleteTask = async (id: string) => {
    if (!confirm(isEn ? "Are you sure you want to delete this task?" : "确定要删除该后台任务吗？")) return;
    
    // 1. 如果是 Mock 任务，直接在前端内存中进行过滤
    if (id.startsWith("task-mock")) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } else {
        // 2. 即使 API 报错，也强制在前端先过滤，不卡用户界面
        console.warn("API 删除任务失败，已在前端执行强制过滤");
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error("删除任务失败:", err);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // ----------------- 界面辅助渲染 -----------------

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background scrollbar-thin">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-6">
        
        {/* ---- 头部 Title & 创建快捷操作 ---- */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              {isEn ? "Smart Workspace" : "智能工作台"}
            </h1>
            <p className="text-xs text-muted">
              {isEn 
                ? "Configure Agents, build RAG vector knowledge bases, and track async AI processes." 
                : "在这里配置个人智能体，沉淀私有 RAG 向量知识资产，并精细追踪后台异步大模型任务。"}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeTab === "agents" && (
              <button
                onClick={() => router.push("/settings/agents")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-85 shadow transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("agents.createAgent")}
              </button>
            )}
            {activeTab === "knowledge" && (
              <button
                onClick={() => router.push("/settings/knowledge")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-85 shadow transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("knowledge.createKb")}
              </button>
            )}
          </div>
        </div>

        {/* 隐藏的上传 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleKbFileChange}
        />

        {/* ---- 导航 Tabs (Agents, Knowledge, Async Tasks) ---- */}
        <div className="flex border-b border-border space-x-1">
          <button
            onClick={() => { setActiveTab("agents"); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "agents"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Bot className="h-4 w-4" />
            {isEn ? "AI Agents" : "智能体专家"}
            <span className="ml-1 rounded-md bg-[var(--sidebar-hover)] px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {agents.length}
            </span>
          </button>
          
          <button
            onClick={() => { setActiveTab("knowledge"); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "knowledge"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Database className="h-4 w-4" />
            {isEn ? "RAG Knowledge" : "向量知识库"}
            <span className="ml-1 rounded-md bg-[var(--sidebar-hover)] px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {knowledgeBases.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "tasks"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Terminal className="h-4 w-4" />
            {isEn ? "Async AI Tasks" : "后台长任务监控"}
            <span className="ml-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 animate-pulse">
              {tasks.filter(t => t.status === "running").length}
            </span>
          </button>
        </div>

        {/* ================= TAB A: 智能体控制台 ================= */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            {agentsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
                <Bot className="mx-auto h-10 w-10 text-muted/30" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{t("agents.noAgents")}</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">{t("agents.noAgentsDesc")}</p>
                </div>
                <button
                  onClick={() => router.push("/settings/agents")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("agents.createAgent")}
                </button>
              </div>
            ) : (
              // ---------------- Agent 列表卡片 ----------------
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="group rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm hover:border-accent/30 hover:shadow transition-all duration-200"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                          {agent.isOrchestrator ? <Crown className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />}
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-foreground group-hover:text-accent transition-colors flex items-center gap-1 truncate">
                            {agent.name}
                            {agent.isOrchestrator && (
                              <span className="rounded bg-accent/10 px-1 py-0.5 text-[8px] font-bold text-accent shrink-0">
                                {t("agents.orchestrator")}
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-muted truncate mt-0.5">{agent.description || "未提供智能体功能描述。"}</p>
                        </div>
                      </div>

                      {/* 编辑 / 删除按钮 */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push("/settings/agents")}
                          className="rounded p-1 text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                          title="修改配置"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="rounded p-1 text-muted hover:bg-[var(--sidebar-hover)] hover:text-danger"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted">
                      <span className="font-semibold text-foreground/80">{agent.model}</span>
                      <span className="flex items-center gap-0.5">
                        <Wrench className="h-3 w-3" />
                        {agent.tools.length} 个工具
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {agent._count.conversations} 次沙箱对话
                      </span>
                    </div>

                    {/* Footer - 点击对话 */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/80">
                      <span className="text-[9px] text-muted truncate max-w-[150px]">
                        系统提示词: {agent.systemPrompt.slice(0, 15)}...
                      </span>
                      
                      <button
                        onClick={() => launchAgentChat(agent.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-[10px] font-bold text-background hover:opacity-85 shadow-sm transition-all"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        {isEn ? "Start Chat" : "新开对话"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB B: RAG 向量知识资产 ================= */}
        {activeTab === "knowledge" && (
          <div className="space-y-4">
            
            {kbLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : knowledgeBases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
                <Database className="mx-auto h-10 w-10 text-muted/30" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{t("knowledge.noKb")}</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">{t("knowledge.noKbDesc")}</p>
                </div>
                <button
                  onClick={() => router.push("/settings/knowledge")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("knowledge.createKb")}
                </button>
              </div>
            ) : (
              // ---------------- 知识库资产列表 ----------------
              <div className="space-y-3">
                {knowledgeBases.map((kb) => (
                  <div
                    key={kb.id}
                    className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:border-accent/15 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 flex-wrap gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => setExpandedKbId(expandedKbId === kb.id ? null : kb.id)}
                          className="text-muted hover:text-foreground"
                        >
                          {expandedKbId === kb.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                          <Database className="h-4.5 w-4.5" />
                        </div>
                        
                        <div className="truncate">
                          <p className="text-xs font-bold text-foreground truncate">{kb.name}</p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {kb._count.documents} {t("knowledge.documents")} · {kb.documents.reduce((sum, d) => sum + d.chunkCount, 0)} {t("knowledge.chunks")}
                          </p>
                        </div>
                      </div>

                      {/* 上传 & 删除 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerKbUpload(kb.id)}
                          disabled={uploadingKbId === kb.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-bold text-muted hover:text-foreground hover:border-foreground/20 disabled:opacity-50 transition-all"
                        >
                          {uploadingKbId === kb.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          {t("knowledge.upload")}
                        </button>

                        <button
                          onClick={() => handleDeleteKb(kb.id)}
                          className="rounded p-1.5 text-muted hover:bg-[var(--sidebar-hover)] hover:text-danger"
                          title={t("knowledge.deleteKb")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Documents List */}
                    {expandedKbId === kb.id && (
                      <div className="border-t border-border/60 bg-background-secondary px-4 py-3 space-y-1.5 animate-fadeIn">
                        {kb.documents.length === 0 ? (
                          <p className="text-[10px] text-muted text-center py-3">{t("knowledge.noDocuments")}</p>
                        ) : (
                          kb.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-lg bg-card border border-border/60 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-muted shrink-0" />
                                <span className="font-medium text-foreground truncate max-w-[280px]">{doc.fileName}</span>
                              </div>
                              
                              <div className="flex items-center gap-3 text-[10px] text-muted shrink-0">
                                <span>{formatFileSize(doc.fileSize)}</span>
                                <span>{doc.chunkCount} {t("knowledge.chunks")}</span>
                                
                                {doc.status === "completed" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : doc.status === "failed" ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB C: 异步 AI 长时任务监控 ================= */}
        {activeTab === "tasks" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{isEn ? "Autonomous Tasks Pipeline" : "长时 AI 对话异步任务看板"}</h3>
                <p className="text-[10px] text-muted mt-0.5">
                  {isEn 
                    ? "Monitor complex tasks deployed in chat, executing quietly in the background." 
                    : "监控在 Chat 对话中下发给 AI 的高级深度执行链任务，静默在后台为个人节省时长。"}
                </p>
              </div>
              <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 flex items-center gap-1 animate-pulse">
                <Clock className="h-3 w-3 animate-spin" />
                {isEn ? `${tasks.filter(t => t.status === "running").length} Task(s) Running` : `${tasks.filter(t => t.status === "running").length} 个任务执行中`}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {tasksLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
                  <Terminal className="mx-auto h-10 w-10 text-muted/30" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{isEn ? "No Tasks" : "暂无任务"}</h3>
                    <p className="text-xs text-muted max-w-sm mx-auto">{isEn ? "There are no background tasks running currently." : "当前没有任何在后台执行的长时任务。"}</p>
                  </div>
                </div>
              ) : tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-sm hover:border-accent/15 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-foreground truncate">{task.name}</h4>
                        <span className="rounded bg-[var(--sidebar-hover)] px-1.5 py-0.5 text-[8px] font-bold text-muted uppercase shrink-0">
                          {task.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted leading-relaxed truncate">{task.details}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold ${
                        task.status === "running"
                          ? "bg-amber-500/10 text-amber-600 animate-pulse border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      }`}>
                        {task.status === "running" ? (isEn ? "Running" : "运行中") : (isEn ? "Completed" : "已完成")}
                      </span>
                      
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="rounded p-1 text-muted hover:bg-[var(--sidebar-hover)] hover:text-danger transition-colors animate-fadeIn"
                        title={isEn ? "Delete Task" : "删除任务"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 进度条与指标 */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-[var(--sidebar-hover)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            task.status === "running"
                              ? "bg-gradient-to-r from-amber-500 to-amber-600 animate-pulse"
                              : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <span className="text-[10px] font-bold text-foreground w-6 text-right">{task.progress}%</span>
                  </div>

                  {/* 底部操作与节省工时 */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/80 text-[10px] text-muted">
                    <span>
                      {isEn ? "Est. Time Saved: " : "累计自动省时: "}
                      <span className="font-bold text-foreground">{task.savedTime || "N/A"}</span>
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {task.conversationId && (
                        <button
                          onClick={() => router.push(`/chat/${task.conversationId}`)}
                          className="inline-flex items-center gap-1 rounded bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent hover:text-background shadow-sm"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {isEn ? "View in Chat" : "前往对话现场"}
                        </button>
                      )}
                      <button
                        onClick={() => setShowLogModal(task)}
                        className="inline-flex items-center gap-1 rounded bg-[var(--sidebar-hover)] px-2.5 py-1 text-[10px] font-bold text-muted transition-colors hover:text-foreground"
                      >
                        <Terminal className="h-3 w-3" />
                        {isEn ? "View Logs" : "查看轨迹"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ================= TERMINAL 风格日志弹窗 (Modal) ================= */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-accent animate-pulse" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {isEn ? "Agent Decision-making Trajectory Logs" : "Agent 智能体自主决策流分析日志"}
                </h3>
              </div>
              <button
                onClick={() => setShowLogModal(null)}
                className="text-muted hover:text-foreground text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[9px] leading-relaxed text-zinc-300 max-h-[300px] overflow-y-auto scrollbar-thin space-y-1">
              <div className="text-zinc-500">// OpenCat Autonomous Agent Log Server //</div>
              {showLogModal.logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap select-all selection:bg-zinc-800">
                  {log}
                </div>
              ))}
              {showLogModal.status === "running" && (
                <div className="flex items-center gap-1.5 text-amber-500 font-bold animate-pulse mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  [SYSTEM] Executing next ReAct step...
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-muted">
              <span>Task ID: <span className="font-semibold text-foreground">{showLogModal.id}</span></span>
              <span>Status: <span className="font-bold text-accent">{showLogModal.status.toUpperCase()}</span></span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
