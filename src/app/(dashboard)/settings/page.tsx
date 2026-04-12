// ============================================================
// Settings 页面 — API Key 管理
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, CheckCircle, XCircle, Key, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PROVIDERS } from "@/lib/llm/registry";

interface ApiKeyItem {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 添加表单
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // 测试状态
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (res.ok) setKeys(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleAdd = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        apiKey: apiKey.trim(),
        label: label.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      }),
    });
    if (res.ok) {
      setApiKey(""); setLabel(""); setBaseUrl(""); setShowAdd(false);
      fetchKeys();
    }
    setSaving(false);
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
        ) : keys.length === 0 && !showAdd ? (
          <div className="rounded-xl border border-border bg-background-secondary p-8 text-center">
            <Key className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-3 text-sm text-muted">No API keys configured</p>
            <p className="mt-1 text-xs text-muted/60">Add a key to start chatting with AI models</p>
            <button
              onClick={() => setShowAdd(true)}
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
                  <p className="text-xs text-muted">{k.provider} · {k.maskedKey}</p>
                  {testResult[k.id] && (
                    <p className={`mt-1 text-xs ${testResult[k.id].ok ? "text-success" : "text-danger"}`}>
                      {testResult[k.id].ok ? <CheckCircle className="inline h-3 w-3 mr-1" /> : <XCircle className="inline h-3 w-3 mr-1" />}
                      {testResult[k.id].msg}
                    </p>
                  )}
                </div>
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

            {!showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm text-muted hover:border-foreground/20 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add another key
              </button>
            )}
          </div>
        )}

        {/* 添加表单 */}
        {showAdd && (
          <div className="mt-4 rounded-xl border border-border bg-background-secondary p-5 space-y-4">
            <h3 className="text-sm font-medium">Add API Key</h3>

            <div>
              <label className="mb-1 block text-xs text-muted">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Custom (OpenAI Compatible)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Label (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My OpenAI Key"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            {(provider === "custom" || provider === "deepseek") && (
              <div>
                <label className="mb-1 block text-xs text-muted">Base URL</label>
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
                onClick={handleAdd}
                disabled={!apiKey.trim() || saving}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                onClick={() => { setShowAdd(false); setApiKey(""); }}
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
