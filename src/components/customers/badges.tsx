import React from "react";
import { AlertTriangle, Clock, Flame, ShieldAlert, Sparkles, UserCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface IntentBadgeProps {
  score: string; // "hot" | "warm" | "cold" | "at-risk"
}

/**
 * 意向等级徽章
 * 提供直观、色彩雅致的视觉指示，量化客户的跟进热度与流失危险
 */
export function IntentBadge({ score }: IntentBadgeProps) {
  const { t } = useTranslation();
  const normalized = score.toLowerCase();
  
  switch (normalized) {
    case "hot":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Flame className="h-3 w-3 fill-amber-500/20" />
          {t("intent.hot")}
        </span>
      );
    case "warm":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
          <Sparkles className="h-3 w-3" />
          {t("intent.warm")}
        </span>
      );
    case "cold":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          <Clock className="h-3 w-3" />
          {t("intent.cold")}
        </span>
      );
    case "at-risk":
    case "at_risk":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
          <ShieldAlert className="h-3 w-3 fill-red-500/10" />
          {t("intent.at-risk" as any)}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          {score}
        </span>
      );
  }
}

interface SignalBadgeProps {
  type: string; // "no_followup" | "sla_breach" | "competitor_mention" | "negative_sentiment" | "trial_expired"
  level?: string; // "INFO" | "WARNING" | "CRITICAL"
}

/**
 * 结构化风险与机会信号徽章
 * 对客户进行实时动态监控，标示其重要风险因子
 */
export function SignalBadge({ type, level = "WARNING" }: SignalBadgeProps) {
  const { locale } = useTranslation();
  const isEn = locale === "en";

  const getLabelAndIcon = () => {
    switch (type) {
      case "no_followup":
        return { label: isEn ? "Follow-up Delay" : "漏跟进预警", icon: Clock };
      case "sla_breach":
        return { label: isEn ? "SLA SLA Breach" : "响应超时 (SLA)", icon: ShieldAlert };
      case "competitor_mention":
        return { label: isEn ? "Competitor Mentioned" : "提及竞品", icon: AlertTriangle };
      case "negative_sentiment":
        return { label: isEn ? "Negative Sentiment" : "负面情绪信号", icon: ShieldAlert };
      case "trial_expired":
        return { label: isEn ? "Trial Expired" : "试用过期", icon: AlertTriangle };
      default:
        return { label: type.replace("_", " "), icon: Sparkles };
    }
  };

  const { label, icon: Icon } = getLabelAndIcon();

  const getStyle = () => {
    switch (level) {
      case "CRITICAL":
        return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
      case "WARNING":
        return "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400";
      case "INFO":
      default:
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${getStyle()}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

interface StageBadgeProps {
  stage: string; // "LEAD" | "TRIAL" | "OPPORTUNITY" | "CUSTOMER" | "CHURNED"
}

/**
 * 销售生命周期阶段徽章
 */
export function StageBadge({ stage }: StageBadgeProps) {
  const { t } = useTranslation();

  const getStyle = () => {
    switch (stage) {
      case "LEAD":
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "TRIAL":
        return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400";
      case "OPPORTUNITY":
        return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "CUSTOMER":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "CHURNED":
        return "border-zinc-500/20 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400";
      default:
        return "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  const getLabel = () => {
    switch (stage) {
      case "LEAD":
      case "TRIAL":
      case "OPPORTUNITY":
      case "CUSTOMER":
      case "CHURNED":
        return t(`stages.${stage}` as any);
      default:
        return stage;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${getStyle()}`}>
      <UserCheck className="h-3 w-3 shrink-0" />
      {getLabel()}
    </span>
  );
}
