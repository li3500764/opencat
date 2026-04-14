// ============================================================
// Knowledge Base 管理页面（Day 6）
// ============================================================
//
// 功能：创建 / 删除知识库 + 上传文档
//
// 页面结构：
//   Header（返回 + 标题）
//   → 知识库列表（卡片式，每个卡片可展开查看文档列表）
//   → 创建知识库表单
//   → 文档上传区（选中某个知识库后可上传 .txt / .md 文件）
//
// 为什么知识库管理页面很重要？
// → 面试时可以讲完整的 RAG 闭环：上传 → 分块 → 向量化 → 检索 → 注入
// → 展示了前后端协作：前端 FormData 上传 → API 处理 → pgvector 存储
//
// ============================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, Loader2, ArrowLeft, Database,
  FileText, Upload, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

// ---------- 类型定义 ----------

// 文档信息（从 API 返回）
interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;        // 字节
  chunkCount: number;      // 分了多少块
  status: string;          // "processing" | "completed" | "failed"
  createdAt: string;
}

// 知识库信息（从 API 返回）
interface KnowledgeBaseItem {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  _count: { documents: number };
  documents: DocumentItem[];
}

// ---------- 工具函数 ----------

// 格式化文件大小（字节 → KB/MB）
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 文档状态图标
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-amber-500" />;
  }
}

// ============================================================
// 主组件
// ============================================================
export default function KnowledgePage() {
  const { t } = useTranslation();

  // ---- 状态 ----
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 创建知识库
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // 展开的知识库 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 上传状态
  const [uploading, setUploading] = useState<string | null>(null); // 正在上传到哪个 KB
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // ---- 获取知识库列表 ----
  const fetchKnowledgeBases = useCallback(async () => {
    const res = await fetch("/api/knowledge");
    if (res.ok) setKnowledgeBases(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // ---- 创建知识库 ----
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (res.ok) {
      setNewName("");
      setShowCreateForm(false);
      fetchKnowledgeBases();
    }
    setCreating(false);
  };

  // ---- 删除知识库 ----
  const handleDelete = async (id: string) => {
    const res = await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  // ---- 上传文档 ----
  // 点击上传按钮时，记录目标知识库 ID，触发文件选择器
  const triggerUpload = (kbId: string) => {
    setUploadTargetId(kbId);
    fileInputRef.current?.click();
  };

  // 文件选中后执行上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;

    // 校验文件类型（只支持 .txt 和 .md）
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md"].includes(ext || "")) {
      alert(t('knowledge.onlyTxtMd'));
      return;
    }

    setUploading(uploadTargetId);

    // 使用 FormData 上传（与 API 的 multipart 处理对应）
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/knowledge/${uploadTargetId}/documents`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      // 上传成功，刷新列表
      fetchKnowledgeBases();
      // 展开该知识库，显示新上传的文档
      setExpandedId(uploadTargetId);
    } else {
      const data = await res.json();
      alert(`${t('knowledge.uploadFailed')} ${data.error || t('common.unknownError')}`);
    }

    setUploading(null);
    setUploadTargetId(null);
    // 清空 input 的 value，允许重复上传同名文件
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- 切换知识库展开/折叠 ----
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
            <h1 className="text-lg font-semibold">{t('knowledge.title')}</h1>
            <p className="text-sm text-muted">
              {t('knowledge.subtitle')}
            </p>
          </div>
        </div>

        {/* 隐藏的文件输入框 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 知识库列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : knowledgeBases.length === 0 && !showCreateForm ? (
          // ---- 空状态 ----
          <div className="rounded-xl border border-border bg-background-secondary p-8 text-center">
            <Database className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-3 text-sm text-muted">{t('knowledge.noKb')}</p>
            <p className="mt-1 text-xs text-muted/60">
              {t('knowledge.noKbDesc')}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" /> {t('knowledge.createKb')}
            </button>
          </div>
        ) : (
          // ---- 知识库卡片列表 ----
          <div className="space-y-3">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className="rounded-xl border border-border bg-background-secondary overflow-hidden"
              >
                {/* 卡片头部 */}
                <div className="flex items-center gap-3 p-4">
                  {/* 展开箭头 */}
                  <button
                    onClick={() => toggleExpand(kb.id)}
                    className="shrink-0 text-muted hover:text-foreground"
                  >
                    {expandedId === kb.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* 图标 */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Database className="h-4 w-4 text-accent" />
                  </div>

                  {/* 名称 + 统计 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{kb.name}</p>
                    <p className="text-[11px] text-muted/70">
                      {kb._count.documents} {t('knowledge.documents')}
                      {" · "}
                      {kb.documents.reduce((sum, d) => sum + d.chunkCount, 0)} {t('knowledge.chunks')}
                    </p>
                  </div>

                  {/* 上传按钮 */}
                  <button
                    onClick={() => triggerUpload(kb.id)}
                    disabled={uploading === kb.id}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground hover:border-foreground/20 disabled:opacity-50"
                    title={t('knowledge.uploadDoc')}
                  >
                    {uploading === kb.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {t('knowledge.upload')}
                  </button>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleDelete(kb.id)}
                    className="rounded-lg p-1.5 text-muted hover:text-danger"
                    title={t('knowledge.deleteKb')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 展开后：文档列表 */}
                {expandedId === kb.id && (
                  <div className="border-t border-border/60 px-4 py-3">
                    {kb.documents.length === 0 ? (
                      <p className="text-xs text-muted/60 text-center py-2">
                        {t('knowledge.noDocuments')}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {kb.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2.5 rounded-lg bg-foreground/[0.03] px-3 py-2"
                          >
                            {/* 文件图标 */}
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted/60" />

                            {/* 文件名 */}
                            <span className="flex-1 truncate text-xs font-medium">
                              {doc.fileName}
                            </span>

                            {/* 统计信息 */}
                            <span className="text-[10px] text-muted/60">
                              {formatFileSize(doc.fileSize)}
                            </span>
                            <span className="text-[10px] text-muted/60">
                              {doc.chunkCount} {t('knowledge.chunks')}
                            </span>

                            {/* 状态 */}
                            <StatusIcon status={doc.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 新建知识库按钮 */}
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm text-muted hover:border-foreground/20 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t('knowledge.createAnother')}
              </button>
            )}
          </div>
        )}

        {/* 创建知识库表单 */}
        {showCreateForm && (
          <div className="mt-4 rounded-xl border border-border bg-background-secondary p-5 space-y-4">
            <h3 className="text-sm font-medium">{t('knowledge.createKb')}</h3>
            <div>
              <label className="mb-1 block text-xs text-muted">{t('knowledge.nameLabel')}</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('knowledge.namePlaceholder')}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/50"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {t('common.create')}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewName(""); }}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
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
