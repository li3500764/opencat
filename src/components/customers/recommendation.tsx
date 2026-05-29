import React, { useState } from "react";
import { Sparkles, Check, X, ArrowUpRight, HelpCircle, Loader2, Edit3 } from "lucide-react";
import { IntentBadge } from "./badges";
import { useTranslation } from "@/lib/i18n";

export interface RecommendationItem {
  id: string;
  intentScore: string;
  riskReason: string | null;
  nextAction: string;
  talkTrack: string | null;
  evidence: any; // Json evidence
  isEscalated: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISMISSED";
  createdAt: string;
}

interface RecommendationCardProps {
  customerId: string;
  recommendation: RecommendationItem | null;
  onReviewSuccess: () => void;
  onAnalyzeTrigger: () => void;
  analyzing: boolean;
}

/**
 * AI 智能跟进建议与话术采纳卡片
 * 人机审批协同的核心 UI。呈现 AI 画像分析、下一步建议并提供采纳、修改草稿、驳回等闭环交互。
 */
export function RecommendationCard({
  customerId,
  recommendation,
  onReviewSuccess,
  onAnalyzeTrigger,
  analyzing,
}: RecommendationCardProps) {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 人工修改草稿状态
  const [isEditingTrack, setIsEditingTrack] = useState(false);
  const [editedTrack, setEditedTrack] = useState("");
  
  // 驳回反馈弹窗状态
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 初始化编辑框的值
  React.useEffect(() => {
    if (recommendation?.talkTrack) {
      setEditedTrack(recommendation.talkTrack);
    }
  }, [recommendation]);

  const handleAction = async (action: "APPROVE" | "REJECT" | "DISMISS" | "ESCALATE", reason?: string) => {
    if (!recommendation) return;
    
    setActionLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/recommendations/${recommendation.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          modifiedContent: action === "APPROVE" && isEditingTrack ? editedTrack : null,
          feedbackReason: reason || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowRejectModal(false);
        setIsEditingTrack(false);
        onReviewSuccess();
      } else {
        setErrorMsg(data.error?.message || (isEn ? "Submission failed" : "提交审批操作失败"));
      }
    } catch {
      setErrorMsg(isEn ? "Network error, please try again" : "网络通讯异常，请稍后重试");
    } finally {
      setActionLoading(false);
    }
  };

  // 解析证据链 JSON
  const renderEvidence = () => {
    if (!recommendation?.evidence) return null;
    try {
      const evidenceList = Array.isArray(recommendation.evidence) 
        ? recommendation.evidence 
        : typeof recommendation.evidence === "string" 
          ? JSON.parse(recommendation.evidence) 
          : [];
      
      if (evidenceList.length === 0) return null;

      return (
        <div className="space-y-1 bg-background-secondary p-3 rounded-lg border border-border">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
            {t("recommendation.evidence") + "："}
          </span>
          <ul className="list-disc list-inside text-xs text-muted/80 space-y-1">
            {evidenceList.map((item: any, idx: number) => (
              <li key={idx} className="leading-relaxed">
                {item.text} <span className="text-[10px] opacity-60">({item.source})</span>
              </li>
            ))}
          </ul>
        </div>
      );
    } catch {
      return null;
    }
  };

  // 没有建议时的空状态或正在分析状态
  if (!recommendation) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center space-y-4">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Sparkles className="h-5 w-5 text-accent animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{t("recommendation.title")}</h3>
          <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">
            {isEn 
              ? "No recommendations logged for this customer. Click the button below to retrieve live drift diagnostic results based on history logs and sales SOP playbooks."
              : "系统当前暂无对此客户的跟进建议。点击下方分析按钮，AI 将根据该客户的 360 度交互历史与 SOP 销售规范生成实时诊断与话术草稿。"}
          </p>
        </div>
        <button
          onClick={onAnalyzeTrigger}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 disabled:opacity-40"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("customers.diagnosing")}
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              {t("customers.diagnose")}
            </>
          )}
        </button>
      </div>
    );
  }

  // 已处理状态的卡片
  if (recommendation.status !== "PENDING") {
    return (
      <div className="rounded-2xl border border-border bg-background-secondary p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>{isEn ? "Intelligent Diagnosis Archive" : "智能诊断记录 (已归档)"}</span>
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            recommendation.status === "APPROVED" 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : recommendation.status === "REJECTED"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-zinc-500/10 text-zinc-500"
          }`}>
            {recommendation.status === "APPROVED" && (isEn ? "Approved" : "已采纳下一步建议")}
            {recommendation.status === "REJECTED" && (isEn ? "Rejected" : "AI 建议已被驳回")}
            {recommendation.status === "DISMISSED" && (isEn ? "Dismissed" : "已忽略此建议")}
          </span>
        </div>
        <div className="border-t border-border pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{isEn ? "Intent Rating:" : "评估意向："}</span>
            <IntentBadge score={recommendation.intentScore} />
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground">{isEn ? "Next Action: " : "下一步动作："}</strong>
            {recommendation.nextAction}
          </p>
        </div>
        <button
          onClick={onAnalyzeTrigger}
          disabled={analyzing}
          className="w-full text-center rounded-lg border border-border py-1.5 text-xs font-medium text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground animate-none"
        >
          {isEn ? "Regenerate AI Analysis Suggestion" : "重新生成 AI 分析建议"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-md relative overflow-hidden"
      style={{ boxShadow: "var(--input-shadow), 0 4px 20px rgba(0,0,0,0.03)" }}
    >
      {/* 顶部 AI 标识 */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
          </div>
          <span className="text-xs font-bold text-foreground">{t("recommendation.title")}</span>
        </div>
        
        {/* 意向评级 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">{isEn ? "AI Intent Level:" : "AI 意向评级:"}</span>
          <IntentBadge score={recommendation.intentScore} />
        </div>
      </div>

      {/* 核心问题原因 (流失/风险警告) */}
      {recommendation.riskReason && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 space-y-1">
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 block uppercase tracking-wider">
            {t("recommendation.riskReason") + "："}
          </span>
          <p className="text-xs text-red-600/90 dark:text-red-400/90 leading-relaxed whitespace-pre-wrap">
            {recommendation.riskReason}
          </p>
        </div>
      )}

      {/* 下一步跟进动作建议 */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
          {t("recommendation.nextAction") + "："}
        </span>
        <p className="text-xs text-foreground font-medium leading-relaxed bg-background-secondary p-3 rounded-lg border border-border whitespace-pre-wrap">
          {recommendation.nextAction}
        </p>
      </div>

      {/* 话术草稿 */}
      {recommendation.talkTrack && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
              {t("recommendation.talkTrack") + "："}
            </span>
            <button
              onClick={() => setIsEditingTrack(!isEditingTrack)}
              className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline font-semibold"
            >
              <Edit3 className="h-2.5 w-2.5" />
              {isEditingTrack ? (isEn ? "Done Editing" : "完成编辑") : t("recommendation.editDraft")}
            </button>
          </div>
          
          {isEditingTrack ? (
            <textarea
              value={editedTrack}
              onChange={(e) => setEditedTrack(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-input-bg p-3 text-xs outline-none focus:border-accent/50 resize-none font-mono text-foreground"
            />
          ) : (
            <div className="rounded-lg border border-border bg-background-secondary p-3.5 text-xs text-foreground/80 font-mono whitespace-pre-wrap leading-relaxed">
              {editedTrack}
            </div>
          )}
        </div>
      )}

      {/* 证据链展示 */}
      {renderEvidence()}

      {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

      {/* 动作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        {/* 主要批准/驳回操作 */}
        <div className="flex gap-2">
          <button
            onClick={() => handleAction("APPROVE")}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3.5 py-2 text-xs font-semibold text-background hover:opacity-85 disabled:opacity-40"
          >
            {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isEn ? "Approve & Apply Copy" : t("recommendation.approve")}
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground transition-colors disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            {t("recommendation.reject")}
          </button>
        </div>

        {/* 次要转人工/忽略操作 */}
        <div className="flex gap-2">
          <button
            onClick={() => handleAction("ESCALATE")}
            disabled={actionLoading || recommendation.isEscalated}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {recommendation.isEscalated ? (isEn ? "Escalated" : "已转交人工") : t("recommendation.escalate")}
          </button>
          <button
            onClick={() => handleAction("DISMISS")}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {t("recommendation.dismiss")}
          </button>
        </div>
      </div>

      {/* 驳回意见对话框 */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <h4 className="text-xs font-bold text-foreground">
              {isEn ? "Submit Rejection Reason (Optimize Engine)" : "提交驳回原因（优化建议引擎）"}
            </h4>
            <p className="text-[11px] text-muted">
              {isEn 
                ? "Your feedback will be logged into memory base to help AI optimize future copywriting."
                : "您的反馈将通过反馈记忆沉淀至底层，帮助 AI 下次给出更符合销售规范的话术。"}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              placeholder={isEn ? "Enter rejection reason to fine-tune AI model..." : t("recommendation.reasonPlaceholder")}
              className="w-full rounded-lg border border-border bg-input-bg px-2.5 py-2 text-xs outline-none focus:border-accent/50 resize-none text-foreground"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => handleAction("REJECT", rejectReason)}
                disabled={actionLoading || !rejectReason.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {isEn ? "Reject" : "确定驳回"}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
