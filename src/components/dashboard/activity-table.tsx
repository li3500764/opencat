// ============================================================
// 最近活动表格组件
// ============================================================
// 展示最近 20 条 API 调用记录

"use client";

import { useTranslation } from "@/lib/i18n";

interface ActivityItem {
  id: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

interface ActivityTableProps {
  data: ActivityItem[];
}

// Provider 配色映射（跟 Settings 页面一致）
const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d97706",
  deepseek: "#0891b2",
  google: "#2563eb",
  custom: "#64748b",
};

export function ActivityTable({ data }: ActivityTableProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium">{t("dashboard.recentActivity")}</h3>
        <p className="py-6 text-center text-xs text-muted">{t("dashboard.noActivity")}</p>
      </div>
    );
  }

  // 格式化时间（相对时间）
  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("dashboard.justNow");
    if (mins < 60) return t("dashboard.minsAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("dashboard.hoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    return t("dashboard.daysAgo", { n: days });
  };

  // 格式化 token 数
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">{t("dashboard.recentActivity")}</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-2 pr-4 font-medium">{t("dashboard.model")}</th>
              <th className="pb-2 pr-4 font-medium">{t("dashboard.provider")}</th>
              <th className="pb-2 pr-4 text-right font-medium">{t("dashboard.input")}</th>
              <th className="pb-2 pr-4 text-right font-medium">{t("dashboard.output")}</th>
              <th className="pb-2 pr-4 text-right font-medium">{t("dashboard.total")}</th>
              <th className="pb-2 pr-4 text-right font-medium">{t("dashboard.cost")}</th>
              <th className="pb-2 text-right font-medium">{t("dashboard.time")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-[var(--sidebar-hover)]"
              >
                <td className="py-2.5 pr-4">
                  <span className="font-medium">{item.model}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      color: PROVIDER_COLORS[item.provider] || "#64748b",
                      backgroundColor: `${PROVIDER_COLORS[item.provider] || "#64748b"}15`,
                    }}
                  >
                    {item.provider}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {formatTokens(item.promptTokens)}
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {formatTokens(item.completionTokens)}
                </td>
                <td className="py-2.5 pr-4 text-right font-medium">
                  {formatTokens(item.totalTokens)}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="text-accent">${item.cost.toFixed(4)}</span>
                </td>
                <td className="py-2.5 text-right text-muted">
                  {formatTime(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
