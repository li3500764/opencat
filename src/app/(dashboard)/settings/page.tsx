// ============================================================
// Settings 页面 — API Key 管理
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, CheckCircle, XCircle, Key, ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { PROVIDERS } from "@/lib/llm/registry";
import { API_FORMAT_LABELS } from "@/lib/llm/types";
import type { ApiFormat } from "@/lib/llm/types";

// ---- Provider → 默认 Format 映射 ----
// 选择 Provider 时自动推荐对应的 API 格式
const PROVIDER_DEFAULT_FORMAT: Record<string, ApiFormat> = {
  openai: "openai-responses",
  anthropic: "anthropic",
  deepseek: "openai",
  google: "google-genai",
  custom: "openai",           // 自定义 Provider 默认走 Chat Completions
};

interface ApiKeyItem {
  id: string;
  provider: string;
  format: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 添加/编辑表单
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 新增模式
  const [provider, setProvider] = useState("openai");
  const [format, setFormat] = useState<ApiFormat>("openai-responses");  // ★ API 协议格式
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
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

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  // ---- 打开新增表单 ----
  const handleShowAdd = () => {
    setEditingId(null);
    setProvider("openai");
    setFormat("openai-responses");
    setApiKey("");
    setLabel("");
    setBaseUrl("");
    setSaveError("");
    setShowForm(true);
  };

  // ---- 打开编辑表单 ----
  const handleEdit = (k: ApiKeyItem) => {
    setEditingId(k.id);
    setProvider(k.provider);
    setFormat((k.format || PROVIDER_DEFAULT_FORMAT[k.provider] || "openai") as ApiFormat);
    setLabel(k.label);
    setBaseUrl(k.baseUrl || "");
    setApiKey(""); // 密钥不回填，留空表示不修改
    setSaveError("");
    setShowForm(true);
  };

  // ---- 保存（新增或编辑） ----
  const handleSave = async () => {
    setSaving(true);
    setSaveError("");

    try {
      if (editingId) {
        // 编辑模式：PUT /api/keys/[id]
        const body: Record<string, string | undefined> = {
          provider,
          format,            // ★ API 格式
          label: label.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
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
          setSaveError(data?.error || data?.message || "Failed to update API key");
          return;
        }

        setShowForm(false);
        setEditingId(null);
        fetchKeys();
      } else {
        // 新增模式：POST /api/keys
        if (!apiKey.trim()) {
          return;
        }

        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            format,            // ★ API 格式
            apiKey: apiKey.trim(),
            label: label.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setSaveError(data?.error || data?.message || "Failed to save API key");
          return;
        }

        setShowForm(false);
        setApiKey("");
        setLabel("");
        setBaseUrl("");
        fetchKeys();
      }
    } catch {
      setSaveError("Network error while saving API key");
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
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/chat" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">API Keys</h1>
            <p className="text-sm text-muted">Manage your LLM provider API keys</p>
          </div>
        </div>

        {/* Key 列表 */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
        ) : keys.length === 0 && !showForm ? (
          <div className="rounded-xl border border-border bg-background-secondary p-8 text-center">
            <Key className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-3 text-sm text-muted">No API keys configured</p>
            <p className="mt-1 text-xs text-muted/60">Add a key to start chatting with AI models</p>
            <button
              onClick={handleShowAdd}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" /> Add API Key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-background-secondary p-4">
                {/* Provider 标识 */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent uppercase">
                  {k.provider.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{k.label}</p>
                  <p className="text-xs text-muted">
                    {k.provider} · <span className="text-muted/70">{API_FORMAT_LABELS[k.format as ApiFormat] || k.format}</span> · {k.maskedKey}
                    {k.baseUrl && <span className="ml-1 text-muted/50">· {k.baseUrl}</span>}
                  </p>
                  {testResult[k.id] && (
                    <p className={`mt-1 text-xs ${testResult[k.id].ok ? "text-success" : "text-danger"}`}>
                      {testResult[k.id].ok ? <CheckCircle className="inline h-3 w-3 mr-1" /> : <XCircle className="inline h-3 w-3 mr-1" />}
                      {testResult[k.id].msg}
                    </p>
                  )}
                </div>
                {/* 编辑按钮 */}
                <button
                  onClick={() => handleEdit(k)}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {/* 测试按钮 */}
                <button
                  onClick={() => handleTest(k.id)}
                  disabled={testing === k.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-foreground/20 disabled:opacity-50"
                >
                  {testing === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                </button>
                <button
                  onClick={() => handleDelete(k.id)}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {!showForm && (
              <button
                onClick={handleShowAdd}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm text-muted hover:border-foreground/20 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add another key
              </button>
            )}
          </div>
        )}

        {/* 添加/编辑表单 */}
        {showForm && (
          <div className="mt-4 rounded-xl border border-border bg-background-secondary p-5 space-y-4">
            <h3 className="text-sm font-medium">
              {editingId ? "Edit API Key" : "Add API Key"}
            </h3>

            <div>
              <label className="mb-1 block text-xs text-muted">Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setProvider(newProvider);
                  // ★ 切换 Provider 时自动推荐对应的 API 格式
                  setFormat(PROVIDER_DEFAULT_FORMAT[newProvider] || "openai");
                }}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Custom (OpenAI Compatible)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">
                API Format
                <span className="text-muted/50 ml-1">(auto-detected, change if using proxy)</span>
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ApiFormat)}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              >
                {(Object.entries(API_FORMAT_LABELS) as [ApiFormat, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">
                API Key
                {editingId && <span className="text-muted/50 ml-1">(leave empty to keep current)</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editingId ? "Leave empty to keep unchanged" : "sk-..."}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Label (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My DeepSeek Key"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            {saveError && (
              <p className="text-sm text-danger">{saveError}</p>
            )}

            {(provider === "custom" || provider === "deepseek" || provider === "google") && (
              <div>
                <label className="mb-1 block text-xs text-muted">
                  Base URL
                  {provider === "deepseek" && (
                    <span className="text-muted/50 ml-1">(default: https://api.deepseek.com)</span>
                  )}
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                  className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={(!editingId && !apiKey.trim()) || saving}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {editingId ? "Save Changes" : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setApiKey("");
                  setFormat("openai-responses");
                  setSaveError("");
                }}
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
