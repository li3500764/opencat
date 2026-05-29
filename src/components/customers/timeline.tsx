import React, { useState } from "react";
import { Mail, Phone, Users, MessageSquare, FileText, Calendar, Plus, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface InteractionItem {
  id: string;
  type: "EMAIL" | "CALL" | "MEETING" | "CHAT" | "NOTE";
  content: string;
  summary: string | null;
  contactDate: string;
  createdAt: string;
}

interface InteractionTimelineProps {
  customerId: string;
  interactions: InteractionItem[];
  onAddSuccess: () => void;
}

/**
 * 沟通历史时间线组件
 * 以时间轴形态展示过往所有交互记录，并支持直接追加沟通日记与电话备注。
 */
export function InteractionTimeline({ customerId, interactions, onAddSuccess }: InteractionTimelineProps) {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState<"EMAIL" | "CALL" | "MEETING" | "CHAT" | "NOTE">("NOTE");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const getIconAndStyle = (type: string) => {
    switch (type) {
      case "EMAIL":
        return { icon: Mail, bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
      case "CALL":
        return { icon: Phone, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
      case "MEETING":
        return { icon: Users, bg: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" };
      case "CHAT":
        return { icon: MessageSquare, bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" };
      case "NOTE":
      default:
        return { icon: FileText, bg: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
    }
  };

  const getTypeText = (type: string) => {
    return t(`interactionTypes.${type}` as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          type,
          content: content.trim(),
          contactDate: new Date().toISOString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setContent("");
        setShowAddForm(false);
        onAddSuccess(); // 刷新父组件状态
      } else {
        setErrorMsg(data.error?.message || (isEn ? "Failed to log interaction" : "添加跟进记录失败"));
      }
    } catch {
      setErrorMsg(isEn ? "Network error, please try again later" : "网关连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题及添加按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("customerDetail.timeline")}</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground transition-colors"
        >
          <Plus className={`h-3 w-3 transition-transform ${showAddForm ? "rotate-45" : ""}`} />
          {t("customerDetail.addNote")}
        </button>
      </div>

      {/* 记录跟进表单 */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["NOTE", "CALL", "EMAIL", "MEETING", "CHAT"] as const).map((tCode) => (
              <button
                key={tCode}
                type="button"
                onClick={() => setType(tCode)}
                className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  type === tCode
                    ? "bg-foreground font-medium text-background"
                    : "border border-border text-muted hover:text-foreground hover:bg-[var(--sidebar-hover)]"
                }`}
              >
                {getTypeText(tCode)}
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            required
            placeholder={t("customerDetail.contentPlaceholder")}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 resize-none text-foreground"
          />

          {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-85 disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("common.save" as any)}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setContent(""); }}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* 时间线列表 */}
      {interactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted/30" />
          <p className="mt-2 text-xs text-muted">{isEn ? "No interaction history logged yet" : "暂无历史沟通记录"}</p>
          <p className="mt-0.5 text-[10px] text-muted/60">
            {isEn ? "Click the top-right button to record your first touchpoint" : "点击右上角“记录跟进”添加第一条互动"}
          </p>
        </div>
      ) : (
        <div className="relative border-l border-border pl-4 ml-3 space-y-6">
          {interactions.map((item) => {
            const { icon: Icon, bg } = getIconAndStyle(item.type);
            const displayDate = new Date(item.contactDate).toLocaleString(isEn ? "en-US" : "zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={item.id} className="relative">
                {/* 时间轴节点 Icon */}
                <div className={`absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background ${bg}`}>
                  <Icon className="h-3 w-3" />
                </div>

                {/* 卡片详情 */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span className="font-semibold text-foreground/80">{getTypeText(item.type)}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {displayDate}
                    </span>
                  </div>
                  
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>
                  
                  {item.summary && (
                    <div className="rounded bg-background-secondary p-2 border-l-2 border-accent/40 text-[11px] text-muted">
                      <span className="font-medium text-[10px] uppercase tracking-wider block text-accent mb-0.5">
                        {isEn ? "AI SUMMARY:" : "AI 摘要："}
                      </span>
                      {item.summary}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
