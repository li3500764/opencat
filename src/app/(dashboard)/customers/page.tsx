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

const BUILTIN_TOOLS = [
  { name: "calculator", label: "计算器" },
  { name: "datetime", label: "日期时间" },
  { name: "http_request", label: "HTTP 请求" },
  { name: "make_pdf", label: "制作 PDF" },
  { name: "make_word", label: "制作 Word" },
  { name: "make_excel", label: "制作 Excel" },
  { name: "make_ppt", label: "制作 PPT" },
];

const DEFAULT_AGENT_FORM = {
  name: "",
  description: "",
  systemPrompt: "你是一个有帮助的 AI 助手。请用中文回复用户。",
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxSteps: 10,
  tools: [] as string[],
  isOrchestrator: false,
};

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
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState(DEFAULT_AGENT_FORM);
  const [agentSaving, setAgentSaving] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [modelsList, setModelsList] = useState<{ id: string; name: string; provider: string }[]>([]);

  // ----------------- 2. 知识库状态与逻辑 -----------------
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [showCreateKbForm, setShowCreateKbForm] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [kbCreating, setKbCreating] = useState(false);
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [uploadingKbId, setUploadingKbId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------- 3. 异步任务状态与逻辑 -----------------
  const [showLogModal, setShowLogModal] = useState<BackgroundTask | null>(null);
  const [mockTasks, setMockTasks] = useState<BackgroundTask[]>([
    {
      id: "task-1",
      name: isEn ? "Autonomous Tech-News Scraping & Summary" : "AI 行业智能情报周报抓取与总结",
      type: "Web Scraper Agent",
      status: "running",
      progress: 88,
      savedTime: "1.5 hours",
      details: isEn ? "Crawling HackerNews & TechCrunch to generate deep insight summary..." : "正在抓取 HackerNews 与 TechCrunch 今日科技资讯，并分析前沿趋势...",
      logs: [
        "[19:20:01] [SYSTEM] 启动自主 Agent 定时抓取任务...",
        "[19:20:03] [THOUGHT] 需要获取最新科技进展。执行 web_search / http_request 工具...",
        "[19:20:06] [CALL] 执行 http_request API: 请求 https://news.ycombinator.com ...",
        "[19:20:09] [RESPONSE] 获取网页成功，大小 42KB。开始解析文本元数据...",
        "[19:20:12] [THOUGHT] 过滤当前热门关键词: deepseek, quantum_computing, nextjs15 ...",
        "[19:20:15] [CALL] 执行 http_request API: 请求 https://techcrunch.com ...",
        "[19:20:19] [RESPONSE] 抓取成功。提取热门文章标题与核心摘要...",
        "[19:20:25] [THOUGHT] 抓取完成。现在注入 LLM 对上下文进行结构化提炼...",
        "[19:20:28] [SYSTEM] AI 智能周报报告大纲生成中（进度 88%）..."
      ]
    },
    {
      id: "task-2",
      name: isEn ? "Knowledge Base Chunk Vectorization" : "OpenCat 知识库文档语义切片向量化",
      type: "RAG Ingestion Pipeline",
      status: "completed",
      progress: 100,
      savedTime: "0.8 hours",
      details: isEn ? "Segmented document into 45 chunks and stored in pgvector successfully." : "对新上传的 pdf / md 手册进行解析，切分为 45 个文本块并存入向量空间。",
      logs: [
        "[16:05:00] [SYSTEM] 检测到新文档「OpenCat_API_v3.md」上传...",
        "[16:05:01] [SYSTEM] 启动 markdown 解析分块逻辑 (chunkSize: 1000, overlap: 200)...",
        "[16:05:03] [SYSTEM] 成功提取 45 个文本切片。准备调用 text-embedding-3-small 向量引擎...",
        "[16:05:05] [CALL] 批量调用 OpenAI Embedding 接口 (45 chunks)...",
        "[16:05:08] [RESPONSE] 向量化转换完毕。获得 1536 维实数向量数组。",
        "[16:05:10] [SYSTEM] 写入 pgvector 扩展数据表中...",
        "[16:05:12] [SYSTEM] HNSW 索引更新完成！检索通路已就绪。任务执行完毕！"
      ]
    },
    {
      id: "task-3",
      name: isEn ? "Automatic Prompt Engineering Optimisation" : "大语言模型提示词自动工程迭代",
      type: "Prompt Refinement Loop",
      status: "completed",
      progress: 100,
      savedTime: "4.5 hours",
      details: isEn ? "Completed 5 loops of automated testing, tweaked system prompts." : "通过对用户对话反馈的自动采样测试，完成 5 轮对抗评估，成功对系统提示词做微调。",
      logs: [
        "[10:00:00] [SYSTEM] 开始提示词工程自动评估优化流...",
        "[10:00:02] [THOUGHT] 评估基线版本: 「v1.2 默认客服助手」在负面情绪检测下的准确度度量...",
        "[10:00:05] [CALL] 批量加载 100 个模拟对抗性测试集...",
        "[10:00:15] [SYSTEM] 测试第 1 轮完成，平均得分 82.5。检测到提示词对否定句响应较慢...",
        "[10:00:17] [THOUGHT] 修改系统提示词，补充「对于用户任何否定、反问句需保持高优先级应答」条款...",
        "[10:00:20] [SYSTEM] 测试第 2 轮完成，平均得分 88.0。表现有明显提升...",
        "[10:00:30] [SYSTEM] 持续进行 5 轮对抗后，平均得分最终收敛至 94.2 分！",
        "[10:00:32] [SYSTEM] 新系统提示词参数已合并至默认模版中，优化闭环结束。"
      ]
    }
  ]);

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

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        const list = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          provider: m.providerLabel || "自定义",
        }));
        setModelsList(list);
      }
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    fetchDefaultProject();
    fetchAgents();
    fetchModels();
    fetchKnowledgeBases();
  }, [fetchDefaultProject, fetchAgents, fetchModels, fetchKnowledgeBases]);

  // ----------------- Agent 业务逻辑 -----------------

  const handleNewAgent = () => {
    setAgentForm(DEFAULT_AGENT_FORM);
    setEditingAgentId(null);
    setShowAgentForm(true);
    setPromptError(null);
  };

  const handleEditAgent = (agent: AgentItem) => {
    setAgentForm({
      name: agent.name,
      description: agent.description || "",
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
      maxSteps: agent.maxSteps,
      tools: agent.tools as string[],
      isOrchestrator: agent.isOrchestrator,
    });
    setEditingAgentId(agent.id);
    setShowAgentForm(true);
    setPromptError(null);
  };

  const handleGeneratePrompt = async () => {
    if (!agentForm.name.trim()) return;
    setGeneratingPrompt(true);
    setPromptError(null);
    try {
      const res = await fetch("/api/agents/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentForm.name, description: agentForm.description }),
      });
      const data = await res.json();
      if (res.ok && data.systemPrompt) {
        setAgentForm((f) => ({ ...f, systemPrompt: data.systemPrompt }));
      } else {
        setPromptError(data.error || "生成提示词失败");
      }
    } catch (err) {
      setPromptError("生成提示词失败");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.name.trim() || !agentForm.systemPrompt.trim()) return;
    setAgentSaving(true);

    try {
      if (editingAgentId) {
        const res = await fetch(`/api/agents/${editingAgentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agentForm),
        });
        if (res.ok) {
          setShowAgentForm(false);
          fetchAgents();
        }
      } else {
        if (!defaultProjectId) {
          setAgentSaving(false);
          return;
        }
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...agentForm, projectId: defaultProjectId }),
        });
        if (res.ok) {
          setShowAgentForm(false);
          fetchAgents();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAgentSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm(isEn ? "Are you sure to delete this Agent?" : "确定要删除该智能体吗？")) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) setAgents((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAgentTool = (toolName: string) => {
    setAgentForm((f) => ({
      ...f,
      tools: f.tools.includes(toolName)
        ? f.tools.filter((t) => t !== toolName)
        : [...f.tools, toolName],
    }));
  };

  const launchAgentChat = (agentId: string) => {
    router.push(`/chat?agentId=${agentId}`);
  };

  // ----------------- 知识库业务逻辑 -----------------

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    setKbCreating(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKbName.trim() }),
      });
      if (res.ok) {
        setNewKbName("");
        setShowCreateKbForm(false);
        fetchKnowledgeBases();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setKbCreating(false);
    }
  };

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
                onClick={handleNewAgent}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-85 shadow transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("agents.createAgent")}
              </button>
            )}
            {activeTab === "knowledge" && (
              <button
                onClick={() => setShowCreateKbForm(true)}
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
            onClick={() => { setActiveTab("agents"); setShowAgentForm(false); }}
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
            onClick={() => { setActiveTab("knowledge"); setShowCreateKbForm(false); }}
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
              1
            </span>
          </button>
        </div>

        {/* ================= TAB A: 智能体控制台 ================= */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            {showAgentForm ? (
              // ---------------- 新建/编辑 Agent 表单界面 ----------------
              <form onSubmit={handleSaveAgent} className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm animate-fadeIn">
                <h3 className="text-sm font-bold text-foreground">
                  {editingAgentId ? t("agents.editAgent") : t("agents.createAgent")}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 左侧基本属性 */}
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.nameLabel")}</label>
                      <input
                        required
                        value={agentForm.name}
                        onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                        placeholder="如: 代码分析师, 数据分析官"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.descLabel")}</label>
                      <input
                        value={agentForm.description}
                        onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                        placeholder="帮助你分析和重构系统架构..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.modelLabel")}</label>
                        <select
                          value={agentForm.model}
                          onChange={(e) => setAgentForm({ ...agentForm, model: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                        >
                          {modelsList.length > 0 ? (
                            modelsList.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.provider} — {m.name}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              ⚠️ 请先去设置中配置 API Key
                            </option>
                          )}
                        </select>
                        {modelsList.length === 0 && (
                          <p className="text-[10px] text-danger font-medium mt-1 animate-fadeIn">
                            检测到未配置 API Key。请先前往设置添加激活密钥。
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.maxSteps")}</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={agentForm.maxSteps}
                          onChange={(e) => setAgentForm({ ...agentForm, maxSteps: parseInt(e.target.value) || 10 })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">
                        温度 ({agentForm.temperature})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={agentForm.temperature}
                        onChange={(e) => setAgentForm({ ...agentForm, temperature: parseFloat(e.target.value) })}
                        className="w-full accent-accent bg-[var(--sidebar-hover)] h-1.5 rounded-full"
                      />
                    </div>
                  </div>

                  {/* 右侧系统提示词 & 工具 */}
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.systemPromptLabel")}</label>
                        <button
                          type="button"
                          onClick={handleGeneratePrompt}
                          disabled={generatingPrompt || !agentForm.name.trim()}
                          className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent transition-all hover:bg-accent/20 disabled:opacity-40"
                        >
                          {generatingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          AI 生成提示词
                        </button>
                      </div>
                      <textarea
                        required
                        rows={5}
                        value={agentForm.systemPrompt}
                        onChange={(e) => setAgentForm({ ...agentForm, systemPrompt: e.target.value })}
                        placeholder="你是一个资深软件架构师，精通微服务、pgvector 向量检索..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground resize-none"
                      />
                      {promptError && <p className="text-[10px] text-danger mt-1">{promptError}</p>}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted uppercase tracking-wider">{t("agents.toolsLabel")}</label>
                      <div className="flex flex-wrap gap-2">
                        {BUILTIN_TOOLS.map((tool) => (
                          <button
                            key={tool.name}
                            type="button"
                            onClick={() => toggleAgentTool(tool.name)}
                            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                              agentForm.tools.includes(tool.name)
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : "border-border text-muted hover:border-foreground/20 hover:text-foreground"
                            }`}
                          >
                            <Wrench className="h-3 w-3" />
                            {tool.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 操作 */}
                <div className="flex flex-col gap-3 pt-3 border-t border-border/80">
                  {modelsList.length === 0 && (
                    <div className="rounded-lg bg-danger/5 border border-danger/10 p-3 text-xs text-danger animate-fadeIn">
                      ⚠️ <strong>保存受阻</strong>：系统检测到您的平台目前尚未录入或激活任何有效的 API 密钥 (API Key)。为了能成功调试和保存智能体，请先前往 <strong>『设置 (Settings) -> API Keys』</strong> 录入并激活至少一个大模型通道。
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={agentSaving || !agentForm.name.trim() || modelsList.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {agentSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAgentForm(false)}
                      className="rounded-lg px-4 py-2 text-xs text-muted hover:text-foreground transition-all"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              </form>
            ) : agentsLoading ? (
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
                  onClick={handleNewAgent}
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
                          onClick={() => handleEditAgent(agent)}
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
            
            {showCreateKbForm && (
              // ---------------- 创建知识库表单 ----------------
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm animate-fadeIn">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{t("knowledge.createKb")}</h3>
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="如: 产品服务条款、竞品技术参数"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateKb(); }}
                    autoFocus
                  />
                  <button
                    onClick={handleCreateKb}
                    disabled={kbCreating || !newName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 transition-all disabled:opacity-50"
                  >
                    {kbCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("common.create")}
                  </button>
                  <button
                    onClick={() => { setShowCreateKbForm(false); setNewName(""); }}
                    className="rounded-lg px-3 py-2 text-xs text-muted hover:text-foreground"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

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
                  onClick={() => setShowCreateKbForm(true)}
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
                {isEn ? "1 Task Running" : "1 个任务执行中"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {mockTasks.map((task) => (
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

                    <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                      task.status === "running"
                        ? "bg-amber-500/10 text-amber-600 animate-pulse border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    }`}>
                      {task.status === "running" ? (isEn ? "Running" : "运行中") : (isEn ? "Completed" : "已完成")}
                    </span>
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
                      <span className="font-bold text-foreground">{task.savedTime}</span>
                    </span>
                    
                    <button
                      onClick={() => setShowLogModal(task)}
                      className="inline-flex items-center gap-1 rounded bg-[var(--sidebar-hover)] px-2.5 py-1 text-[10px] font-bold text-muted transition-colors hover:text-foreground"
                    >
                      <Terminal className="h-3 w-3" />
                      {isEn ? "View Agent Execution Logs" : "查看 Agent 决策轨迹日志"}
                    </button>
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
