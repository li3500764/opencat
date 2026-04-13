// ============================================================
// Agent 管理页面（Day 5）
// ============================================================
//
// 功能：创建/编辑/删除自定义 Agent
//
// 页面结构：
//   Header（返回 + 标题）
//   → Agent 列表（卡片式）
//   → 创建/编辑表单（展开式）
//
// 每个 Agent 卡片显示：
//   - 名称 + 描述
//   - 模型 + 工具数量
//   - 对话数量
//   - 编辑 / 删除按钮
//
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Loader2, ArrowLeft, Bot,
  Pencil, Wrench, MessageSquare, Crown,
} from "lucide-react";
import Link from "next/link";
import { PROVIDERS } from "@/lib/llm/registry";

// ---------- Agent 数据类型 ----------
// 与 API 返回的格式对应
interface AgentItem {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxSteps: number;
  tools: string[];           // 工具名列表
  isOrchestrator: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  _count: { conversations: number };
}

// ---------- 所有可用模型的扁平列表（从 Provider 注册表取） ----------
// 用于 Agent 的模型选择下拉框
const ALL_MODELS = PROVIDERS.flatMap((p) =>
  p.models.map((m) => ({ id: m.id, name: m.name, provider: p.name }))
);

// ---------- 内置工具列表（硬编码，与 Day 4 注册的工具对应） ----------
// 将来可以从 /api/tools 动态获取
const BUILTIN_TOOLS = [
  { name: "calculator", label: "计算器" },
  { name: "datetime", label: "日期时间" },
  { name: "http_request", label: "HTTP 请求" },
];

// ---------- 表单默认值 ----------
const DEFAULT_FORM = {
  name: "",
  description: "",
  systemPrompt: "你是一个有帮助的 AI 助手。请用中文回复用户。",
  model: "gpt-4o",
  temperature: 0.7,
  maxSteps: 10,
  tools: [] as string[],
  isOrchestrator: false,
};

export default function AgentsPage() {
  // ---- 状态 ----
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 新建
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // ---- 获取 Agent 列表 ----
  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.ok) setAgents(await res.json());
    setLoading(false);
  }, []);

  // ---- 获取默认 Project ID ----
  // Agent 必须属于一个 Project
  // 我们自动使用 Default Project，与 Chat 流程保持一致
  const fetchDefaultProject = useCallback(async () => {
    const res = await fetch("/api/projects/default");
    if (res.ok) {
      const data = await res.json();
      setDefaultProjectId(data.id);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchDefaultProject();
  }, [fetchAgents, fetchDefaultProject]);

  // ---- 打开新建表单 ----
  const handleNew = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  // ---- 打开编辑表单 ----
  const handleEdit = (agent: AgentItem) => {
    setForm({
      name: agent.name,
      description: agent.description || "",
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
      maxSteps: agent.maxSteps,
      tools: agent.tools as string[],
      isOrchestrator: agent.isOrchestrator,
    });
    setEditingId(agent.id);
    setShowForm(true);
  };

  // ---- 保存（新建或更新） ----
  const handleSave = async () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) return;
    setSaving(true);

    if (editingId) {
      // 更新已有 Agent
      const res = await fetch(`/api/agents/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        fetchAgents();
      }
    } else {
      // 创建新 Agent
      if (!defaultProjectId) {
        setSaving(false);
        return;
      }
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId: defaultProjectId }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(DEFAULT_FORM);
        fetchAgents();
      }
    }

    setSaving(false);
  };

  // ---- 删除 Agent ----
  const handleDelete = async (id: string) => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    setAgents((a) => a.filter((x) => x.id !== id));
  };

  // ---- 工具复选框切换 ----
  const toggleTool = (toolName: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(toolName)
        ? f.tools.filter((t) => t !== toolName)
        : [...f.tools, toolName],
    }));
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/chat"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Agents</h1>
            <p className="text-sm text-muted">
              Create and manage AI agents with custom prompts and tools
            </p>
          </div>
        </div>

        {/* Agent 列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : agents.length === 0 && !showForm ? (
          <div className="rounded-xl border border-border bg-background-secondary p-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-3 text-sm text-muted">No agents created yet</p>
            <p className="mt-1 text-xs text-muted/60">
              Create an agent with custom system prompt and tools
            </p>
            <button
              onClick={handleNew}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" /> Create Agent
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-background-secondary p-4"
              >
                {/* Agent 图标 */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  {agent.isOrchestrator ? (
                    <Crown className="h-4 w-4 text-accent" />
                  ) : (
                    <Bot className="h-4 w-4 text-accent" />
                  )}
                </div>

                {/* Agent 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{agent.name}</p>
                    {agent.isOrchestrator && (
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        Orchestrator
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="mt-0.5 text-xs text-muted truncate">{agent.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted/70">
                    <span>{agent.model}</span>
                    <span className="flex items-center gap-0.5">
                      <Wrench className="h-2.5 w-2.5" />
                      {(agent.tools as string[]).length} tools
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {agent._count.conversations} chats
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <button
                  onClick={() => handleEdit(agent)}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* 新建按钮 */}
            {!showForm && (
              <button
                onClick={handleNew}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm text-muted hover:border-foreground/20 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Create another agent
              </button>
            )}
          </div>
        )}

        {/* 创建/编辑表单 */}
        {showForm && (
          <div className="mt-4 rounded-xl border border-border bg-background-secondary p-5 space-y-4">
            <h3 className="text-sm font-medium">
              {editingId ? "Edit Agent" : "Create Agent"}
            </h3>

            {/* 名称 */}
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="代码助手"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="mb-1 block text-xs text-muted">Description (optional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="帮助你编写和调试代码"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            {/* 系统提示词 */}
            <div>
              <label className="mb-1 block text-xs text-muted">System Prompt</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                rows={4}
                placeholder="你是一个专业的代码助手..."
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 resize-none"
              />
            </div>

            {/* 模型选择 */}
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              >
                {ALL_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 温度 + 最大步数（水平布局） */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-muted">
                  Temperature ({form.temperature})
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Max Steps</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxSteps}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxSteps: parseInt(e.target.value) || 10 }))
                  }
                  className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
                />
              </div>
            </div>

            {/* 工具选择（复选框） */}
            <div>
              <label className="mb-1.5 block text-xs text-muted">Tools</label>
              <div className="flex flex-wrap gap-2">
                {BUILTIN_TOOLS.map((tool) => (
                  <label
                    key={tool.name}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.tools.includes(tool.name)
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-border text-muted hover:border-foreground/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.tools.includes(tool.name)}
                      onChange={() => toggleTool(tool.name)}
                      className="hidden"
                    />
                    <Wrench className="h-3 w-3" />
                    {tool.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Orchestrator 开关 */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isOrchestrator}
                onChange={(e) => setForm((f) => ({ ...f, isOrchestrator: e.target.checked }))}
                className="accent-accent"
              />
              <span className="text-xs text-muted">
                Orchestrator mode（可以调用其他 Agent）
              </span>
            </label>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.systemPrompt.trim() || saving}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {editingId ? "Save Changes" : "Create"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
