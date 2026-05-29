// ============================================================
// Settings 页面 — API Key 管理 (仅限 OpenAI 兼容格式)
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, CheckCircle, XCircle, Key, ArrowLeft, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

interface ApiModelInfo {
  id: string;
  name: string;
}

interface ApiKeyItem {
  id: string;
  provider: string;
  format: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
  models: ApiModelInfo[];
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- 默认模型相关状态 ----
  const [defaultModel, setDefaultModel] = useState<string>("gpt-5.4-mini");
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState<string>("text-embedding-3-small");
  const [savingModel, setSavingModel] = useState(false);

  // 添加/编辑表单
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 新增模式
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  
  // 自定义模型列表状态
  const [modelsList, setModelsList] = useState<ApiModelInfo[]>([]);
  const [inputModelId, setInputModelId] = useState("");
  const [inputModelName, setInputModelName] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 测试状态
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (res.ok) setKeys(await res.json());
    setLoading(false);
  }, []);

  const fetchProject = useCallback(async () => {
    const res = await fetch("/api/projects/default");
    if (res.ok) {
      const data = await res.json();
      if (data.defaultModel) setDefaultModel(data.defaultModel);
      if (data.defaultEmbeddingModel) setDefaultEmbeddingModel(data.defaultEmbeddingModel);
    }
  }, []);

  useEffect(() => { 
    fetchKeys(); 
    fetchProject();
  }, [fetchKeys, fetchProject]);

  const handleUpdateDefaultModel = async (modelId: string) => {
    setDefaultModel(modelId);
    setSavingModel(true);
    await fetch("/api/projects/default", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultModel: modelId })
    });
    setSavingModel(false);
  };

  const handleUpdateDefaultEmbeddingModel = async (modelId: string) => {
    setDefaultEmbeddingModel(modelId);
    setSavingModel(true);
    await fetch("/api/projects/default", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultEmbeddingModel: modelId })
    });
    setSavingModel(false);
  };

  const allAvailableModels = Array.from(
    new Map(keys.flatMap(k => k.models || []).map(m => [m.id, m.name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // ---- 打开新增表单 ----
  const handleShowAdd = () => {
    setEditingId(null);
    setApiKey("");
    setLabel("");
    setBaseUrl("");
    // 默认提供几个常用 OpenAI 兼容模型，免去用户手动填写的痛苦，作为极佳的用户引导体验
    setModelsList([
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "deepseek-chat", name: "DeepSeek V3" },
      { id: "deepseek-reasoner", name: "DeepSeek R1" }
    ]);
    setInputModelId("");
    setInputModelName("");
    setSaveError("");
    setShowForm(true);
  };

  // ---- 打开编辑表单 ----
  const handleEdit = (k: ApiKeyItem) => {
    setEditingId(k.id);
    setLabel(k.label);
    setBaseUrl(k.baseUrl || "");
    setApiKey(""); // 密钥安全起见不回填，留空表示不修改
    setModelsList(k.models || []);
    setInputModelId("");
    setInputModelName("");
    setSaveError("");
    setShowForm(true);
  };

  // ---- 添加自定义模型到临时列表 ----
  const handleAddCustomModel = () => {
    const modelId = inputModelId.trim();
    const modelName = inputModelName.trim() || modelId;

    if (!modelId) {
      setSaveError("模型 ID 不能为空");
      return;
    }

    if (modelsList.some((m) => m.id === modelId)) {
      setSaveError("该模型 ID 已经存在于列表中");
      return;
    }

    setModelsList([...modelsList, { id: modelId, name: modelName }]);
    setInputModelId("");
    setInputModelName("");
    setSaveError("");
  };

  // ---- 从临时列表中移除模型 ----
  const handleRemoveModel = (id: string) => {
    setModelsList(modelsList.filter((m) => m.id !== id));
  };

  // ---- 保存（新增或编辑） ----
  const handleSave = async () => {
    if (modelsList.length === 0) {
      setSaveError("至少需要配置一个可用的 AI 模型");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      if (editingId) {
        // 编辑模式：PUT /api/keys/[id]
        const body: Record<string, any> = {
          label: label.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          models: modelsList,
        };
        // 只有用户填了新 Key 才传（不填 = 不改）
        if (apiKey.trim()) {
          body.apiKey = apiKey.trim();
        }

        const res = await fetch(`/api/keys/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setSaveError(data?.error || data?.message || "更新 API Key 失败");
          return;
        }

        setShowForm(false);
        setEditingId(null);
        fetchKeys();
      } else {
        // 新增模式：POST /api/keys
        if (!apiKey.trim()) {
          setSaveError("API Key 不能为空");
          return;
        }

        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: apiKey.trim(),
            label: label.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
            models: modelsList,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setSaveError(data?.error || data?.message || "保存 API Key 失败");
          return;
        }

        setShowForm(false);
        setApiKey("");
        setLabel("");
        setBaseUrl("");
        setModelsList([]);
        fetchKeys();
      }
    } catch {
      setSaveError("保存 API Key 时发生网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    setKeys((k) => k.filter((x) => x.id !== id));
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult((r) => ({ ...r, [id]: undefined as unknown as { ok: boolean; msg: string } }));
    const res = await fetch(`/api/keys/${id}`, { method: "POST" });
    const data = await res.json();
    setTestResult((r) => ({ ...r, [id]: { ok: data.success, msg: data.message } }));
    setTesting(null);
  };


  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* 顶部标题栏 */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/chat" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{t('settings.title')}</h1>
            <p className="text-sm text-muted">自定义你的 OpenAI 兼容格式大模型提供商及密钥</p>
          </div>
        </div>

        {/* 全局默认模型设置 */}
        {!loading && (
          <div className="mb-6 rounded-xl border border-border bg-background-secondary p-5 space-y-4">
            {/* 对话 & 诊断基座模型 */}
            <div>
              <h2 className="text-sm font-semibold">全局默认大模型</h2>
              <p className="text-xs text-muted mt-1">设置系统中默认调用的 AI 模型（如 CRI 分析、默认 Agent 兜底策略）。</p>
              <div className="flex items-center gap-3 mt-3">
                <select
                  value={defaultModel}
                  onChange={(e) => handleUpdateDefaultModel(e.target.value)}
                  disabled={savingModel || keys.length === 0}
                  className="w-full max-w-xs rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 disabled:opacity-50"
                >
                  {allAvailableModels.length === 0 ? (
                    <option value={defaultModel}>{defaultModel} (无可用 Key)</option>
                  ) : (
                    allAvailableModels.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))
                  )}
                </select>
                {savingModel && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                {keys.length === 0 && <span className="text-xs text-danger">请先在下方配置 API Key</span>}
              </div>
            </div>

            {/* Embedding 向量化模型 */}
            <div className="pt-3 border-t border-border/40">
              <h2 className="text-sm font-semibold">全局向量化 (Embedding) 模型</h2>
              <p className="text-xs text-muted mt-1">用于 RAG 知识库与记忆库的文档嵌入与相似度检索。</p>
              <div className="flex items-center gap-3 mt-3">
                <select
                  value={defaultEmbeddingModel}
                  onChange={(e) => handleUpdateDefaultEmbeddingModel(e.target.value)}
                  disabled={savingModel || keys.length === 0}
                  className="w-full max-w-xs rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 disabled:opacity-50"
                >
                  {allAvailableModels.length === 0 ? (
                    <option value={defaultEmbeddingModel}>{defaultEmbeddingModel} (无可用 Key)</option>
                  ) : (
                    allAvailableModels.map(m => (
                      <option key={`emb-${m.id}`} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))
                  )}
                </select>
                {savingModel && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
              </div>
            </div>
          </div>
        )}

        {/* 密钥卡片列表 */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
        ) : keys.length === 0 && !showForm ? (
          <div className="rounded-xl border border-border bg-background-secondary p-8 text-center animate-fadeIn">
            <Key className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-3 text-sm text-muted">{t('settings.noKeys')}</p>
            <p className="mt-1 text-xs text-muted/60">{t('settings.noKeysDesc')}</p>
            <button
              onClick={handleShowAdd}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> {t('settings.addKey')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background-secondary p-4 hover:border-foreground/10 transition-all">
                <div className="flex items-center gap-3">
                  {/* 高颜值钥匙标识 */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Key className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.label}</p>
                    <p className="text-xs text-muted truncate">
                      OpenAI 协议 · {k.maskedKey}
                      {k.baseUrl && <span className="ml-1 text-muted/50">· {k.baseUrl}</span>}
                    </p>
                  </div>
                  {/* 卡片右侧快捷操作 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(k)}
                      className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-[var(--sidebar-hover)] transition-colors"
                      title={t('common.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleTest(k.id)}
                      disabled={testing === k.id}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {testing === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t('settings.test')}
                    </button>
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger/5 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* 精巧渲染当前 Key 支持的模型列表 */}
                {k.models && k.models.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                    {k.models.map((m) => (
                      <span key={m.id} className="inline-flex items-center rounded bg-background px-2 py-0.5 text-[10px] font-medium text-muted border border-border/60">
                        {m.name} <span className="text-[9px] text-muted/40 ml-1">({m.id})</span>
                      </span>
                    ))}
                  </div>
                )}

                {testResult[k.id] && (
                  <div className={`mt-1 text-xs px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 ${testResult[k.id].ok ? "bg-success/5 text-success border border-success/15" : "bg-danger/5 text-danger border border-danger/15"}`}>
                    {testResult[k.id].ok ? (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-scaleIn" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-scaleIn" />
                    )}
                    <span className="break-all font-mono text-[11px]">{testResult[k.id].msg}</span>
                  </div>
                )}
              </div>
            ))}

            {!showForm && (
              <button
                onClick={handleShowAdd}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted hover:border-foreground/20 hover:text-foreground transition-all hover:bg-background-secondary/50"
              >
                <Plus className="h-3.5 w-3.5" /> {t('settings.addAnotherKey')}
              </button>
            )}
          </div>
        )}

        {/* 添加/编辑表单面板 */}
        {showForm && (
          <div className="mt-4 rounded-xl border border-border bg-background-secondary p-5 space-y-4 shadow-sm animate-slideDown">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-medium">
                {editingId ? "修改 API 密钥配置" : "配置新的 OpenAI 兼容密钥"}
              </h3>
            </div>

            {/* 备注名称 */}
            <div>
              <label className="mb-1 block text-xs text-muted">提供商备注名称</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例如: DeepSeek 官方、硅基流动代理"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* API Key 密钥输入 */}
            <div>
              <label className="mb-1 block text-xs text-muted font-medium">
                API 密钥 (API Key)
                {editingId && <span className="text-muted/50 ml-1 font-normal">(留空表示不修改原密钥)</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editingId ? "••••••••••••••••" : "填入 API Key 密钥 (如 sk-...)"}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* 接口自定义地址 Base URL */}
            <div>
              <label className="mb-1 block text-xs text-muted">
                接口自定义地址 (Base URL)
                <span className="text-muted/50 ml-1">(选填)</span>
              </label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="例如: https://api.deepseek.com/v1 (留空则默认使用 OpenAI 官方)"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Premium 复合双字段模型 ID 标签输入器 */}
            <div className="border-t border-border/60 pt-3">
              <label className="mb-1.5 block text-xs text-muted font-medium">
                支持的模型列表 (Model IDs)
                <span className="text-muted/50 ml-1 font-normal">(至少配置一个以供系统调用选择)</span>
              </label>
              
              {/* 输入区域 */}
              <div className="flex gap-2">
                <input
                  value={inputModelId}
                  onChange={(e) => setInputModelId(e.target.value)}
                  placeholder="模型 ID (如: deepseek-chat)"
                  className="flex-1 rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomModel();
                    }
                  }}
                />
                <input
                  value={inputModelName}
                  onChange={(e) => setInputModelName(e.target.value)}
                  placeholder="展示名称 (如: DeepSeek V3)"
                  className="flex-1 rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomModel();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomModel}
                  className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-80 active:scale-95 transition-all"
                >
                  添加
                </button>
              </div>

              {/* 渲染当前配置的胶囊列表 */}
              <div className="mt-2.5 flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-background-secondary rounded-lg border border-border/40">
                {modelsList.length === 0 ? (
                  <span className="text-xs text-muted/40 m-auto">暂无配置模型，请在上方添加</span>
                ) : (
                  modelsList.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent border border-accent/20 animate-scaleIn">
                      {m.name}
                      <span className="text-[10px] text-accent/50">({m.id})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModel(m.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-accent/20 hover:text-accent-foreground text-accent/60 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-danger animate-pulse bg-danger/5 p-2 rounded-lg border border-danger/15">{saveError}</p>
            )}

            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button
                onClick={handleSave}
                disabled={(!editingId && !apiKey.trim()) || saving}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {editingId ? t('settings.saveChanges') : t('common.save')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setApiKey("");
                  setModelsList([]);
                  setInputModelId("");
                  setInputModelName("");
                  setSaveError("");
                }}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-[var(--sidebar-hover)] transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

