// ============================================================
// CRI Dashboard 商业价值与 ROI 看板主页面 (Day 11 重构版)
// ============================================================
//
// 职责：
//   1. 渲染企业级四大核心商业 ROI 价值指标卡片 (挽回 Pipeline、节省工时、采纳率、活跃预警)。
//   2. 升级纯 SVG 折线趋势图，支持一键动态切换展示“累计挽回金额趋势”与“节省工时趋势”。
//   3. 使用纯 CSS 与高保真组件渲染“销售阶段生命周期漏斗 (Funnel)”与“高发风险预警排行榜”。
//   4. 展示 Outcome 闭环追踪流水账本 (ROI Ledger)，呈现每次成功业务转化的详细印记。
//
// 数据来源：GET /api/stats 接口返回的聚合大包
// ============================================================

"use client";

import React, { useEffect, useState } from "react";
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Building2,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Bot
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { StatCard, LineChart } from "@/components/dashboard";
import { StageBadge, SignalBadge } from "@/components/customers/badges";

// 强类型定义
interface OutcomeLedgerItem {
  id: string;
  customerId: string;
  customerName: string;
  contactName: string | null;
  stage: string;
  savedValue: number;
  savedHours: number;
  feedback: string | null;
  createdAt: string;
}

interface StatsData {
  totalSavedValue: number;
  totalSavedHours: number;
  activeSignalsCount: number;
  adoptionRate: number;
  recStats: {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    DISMISSED: number;
  };
  stageDistribution: {
    LEAD: number;
    TRIAL: number;
    OPPORTUNITY: number;
    CUSTOMER: number;
    CHURNED: number;
  };
  signalStats: Array<{
    type: string;
    count: number;
  }>;
  dailyRoiTrend: Array<{
    date: string;
    value: number;
    hours: number;
  }>;
  outcomesLedger: OutcomeLedgerItem[];
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 折线图当前展示指标状态："value" (挽回金额) 还是 "hours" (节省时间)
  const [chartMetric, setChartMetric] = useState<"value" | "hours">("value");

  // 获取 Dashboard 聚合大包
  const fetchStats = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(t("dashboard.failedToFetch"));
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setErrorMsg(err.message || t("common.unknownError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (errorMsg || !stats) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-danger">{errorMsg || t("common.failedToLoad")}</p>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  // 格式化货币
  const formatCost = (v: number) => {
    return `$${v.toLocaleString(isEn ? "en-US" : "zh-CN", { maximumFractionDigits: 1 })}`;
  };

  // 统计客户漏斗总量
  const funnelTotal = Object.values(stats.stageDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-6">
        
        {/* ---- 页面标题 & 刷新按钮 ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("dashboard.title")}</h1>
            <p className="text-xs text-muted mt-1">
              {isEn 
                ? "RevenueOps Customer Relationship Intelligence (CRI) ROI Dashboard" 
                : "客户关系智能系统 (CRI) 商业价值复盘与 ROI 大盘分析"}
            </p>
          </div>
          <button
            onClick={fetchStats}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            {t("common.refresh")}
          </button>
        </div>

        {/* ================= 第一板块：四大企业核心 ROI 指标卡 ================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 累计挽回金额卡 (金色琥珀) */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">
                {t("dashboard.totalSavedValue")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {formatCost(stats.totalSavedValue)}
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                <TrendingUp className="h-2.5 w-2.5 text-amber-500" />
                {isEn ? "Pipeline value salvaged" : "已挽回商机金额"}
              </p>
            </div>
          </div>

          {/* 累计节省时间卡 (蓝色) */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600/80 uppercase tracking-wider">
                {t("dashboard.totalSavedHours")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {stats.totalSavedHours.toFixed(1)} <span className="text-xs font-semibold text-muted">h</span>
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                <CheckCircle className="h-2.5 w-2.5 text-blue-500" />
                {isEn ? "SOP hours automated" : "自动建议节省时长"}
              </p>
            </div>
          </div>

          {/* AI 建议采纳率卡 (绿色) */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">
                {t("dashboard.adoptionRate")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {stats.adoptionRate}%
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                {isEn ? "Co-pilot engagement" : "销售审核采纳黏性"}
              </p>
            </div>
          </div>

          {/* 活跃预警数量卡 (红色) */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">
                {t("dashboard.activeSignals")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {stats.activeSignalsCount}
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                {isEn ? "Unresolved risk flags" : "未决跟进/流失敞口"}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 第二板块：14 天 ROI 趋势大图 (支持指标动态切换) ================= */}
        <div className="relative rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-accent" />
              {t("dashboard.roiTrendTitle")}
            </h3>
            
            {/* 指标选择切换 tab */}
            <div className="flex rounded-lg bg-background-secondary p-1 border border-border">
              <button
                onClick={() => setChartMetric("value")}
                className={`rounded px-3 py-1 text-xs font-medium transition-all ${
                  chartMetric === "value"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t("dashboard.savedValue")}
              </button>
              <button
                onClick={() => setChartMetric("hours")}
                className={`rounded px-3 py-1 text-xs font-medium transition-all ${
                  chartMetric === "hours"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t("dashboard.savedHours")}
              </button>
            </div>
          </div>

          {/* 渲染纯手绘 SVG 折线图 */}
          <LineChart
            data={stats.dailyRoiTrend}
            dataKey={chartMetric}
            title={chartMetric === "value" ? t("dashboard.savedValue") : t("dashboard.savedHours")}
            color={chartMetric === "value" ? "#f59e0b" : "#3b82f6"} // 琥珀色 VS 蓝色
            emptyText={isEn ? "No ROI outcomes recorded yet" : "暂无 ROI 价值转化数据"}
          />
        </div>

        {/* ================= 第三板块：生命周期漏斗分布 & 活跃风险预警排行 (并排两列) ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* (A) 生命周期漏斗 (Funnel) */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border">
                {t("dashboard.funnelTitle")}
              </h3>
              <p className="text-[10px] text-muted mt-1">{t("dashboard.funnelDesc")}</p>
            </div>

            {funnelTotal === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                {isEn ? "No client data found" : "暂无客户漏斗数据"}
              </div>
            ) : (
              <div className="space-y-3.5 my-2">
                {(["LEAD", "TRIAL", "OPPORTUNITY", "CUSTOMER", "CHURNED"] as const).map((stage) => {
                  const val = stats.stageDistribution[stage] || 0;
                  const pct = funnelTotal > 0 ? Math.round((val / funnelTotal) * 100) : 0;
                  
                  // 为不同阶段分配精致的色系
                  const getBarColor = (s: string) => {
                    switch (s) {
                      case "LEAD": return "bg-blue-500";
                      case "TRIAL": return "bg-purple-500";
                      case "OPPORTUNITY": return "bg-amber-500";
                      case "CUSTOMER": return "bg-emerald-500";
                      case "CHURNED":
                      default: return "bg-zinc-400 dark:bg-zinc-600";
                    }
                  };

                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground/80">{t(`stages.${stage}` as any)}</span>
                        <span className="text-muted font-medium">
                          {val} {isEn ? "Items" : "个"} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background-secondary border border-border">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getBarColor(stage)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="text-[10px] text-muted flex items-center justify-between pt-2 border-t border-border">
              <span>{isEn ? "Funnel aggregate count:" : "漏斗录入总客户数:"}</span>
              <span className="font-bold text-foreground">{funnelTotal}</span>
            </div>
          </div>

          {/* (B) 活跃预警排行 (Drift Alerts Top) */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
                <span>{t("dashboard.signalsList")}</span>
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
                  {stats.activeSignalsCount} {isEn ? "Unresolved" : "未决"}
                </span>
              </h3>
              <p className="text-[10px] text-muted mt-1">
                {isEn ? "Real-time process risk rankings and SLA bottlenecks" : "基于 SLA 超时与 AI 意向模型监控出的高发痛点排行"}
              </p>
            </div>

            {stats.signalStats.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle className="mx-auto h-8 w-8 text-emerald-500/70" />
                <p className="text-xs text-muted">{t("customerDetail.noSignals")}</p>
              </div>
            ) : (
              <div className="space-y-3.5 my-2">
                {stats.signalStats.slice(0, 4).map((item, idx) => {
                  
                  // 将已知类型显示中文或翻译，兼容英文
                  const getSignalLabel = (type: string) => {
                    switch (type) {
                      case "no_followup": return isEn ? "Follow-up Delay" : "漏跟进预警";
                      case "sla_breach": return isEn ? "SLA SLA Breach" : "响应超时 (SLA)";
                      case "competitor_mention": return isEn ? "Competitor Mentioned" : "提及竞品";
                      case "negative_sentiment": return isEn ? "Negative Sentiment" : "负面情绪信号";
                      case "trial_expired": return isEn ? "Trial Expired" : "试用过期";
                      default: return type.replace("_", " ");
                    }
                  };

                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-background-secondary text-[10px] font-bold text-muted border border-border">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground/80 truncate">{getSignalLabel(item.type)}</span>
                      </div>
                      <span className="rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                        {item.count} {isEn ? "Customers" : "户警告"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-[10px] text-muted flex items-center justify-between pt-2 border-t border-border">
              <span>{isEn ? "Diagnostic alerts overall:" : "AI 预警监控大盘状态:"}</span>
              <span className={`font-bold flex items-center gap-0.5 ${stats.activeSignalsCount > 0 ? "text-danger" : "text-emerald-500"}`}>
                {stats.activeSignalsCount > 0 
                  ? (isEn ? "Risks Pending" : "存在潜在流失敞口") 
                  : (isEn ? "Healthy" : "良好健康运行中")}
              </span>
            </div>
          </div>

        </div>

        {/* ================= 第四板块：Outcome 闭环价值复盘明细账本 (ROI Ledger) ================= */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
              <span>{t("dashboard.ledgerTitle")}</span>
              <span className="text-[10px] text-muted normal-case font-normal">
                {isEn ? "Recent 10 conversions audit trail" : "最近 10 次成功的跟进转化记录审计"}
              </span>
            </h3>
          </div>

          {stats.outcomesLedger.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center space-y-3">
              <Bot className="mx-auto h-8 w-8 text-muted/30" />
              <div className="space-y-1">
                <p className="text-xs text-muted">{isEn ? "No Outcomes logged yet" : "暂无业务转化 Outcome 记录"}</p>
                <p className="text-[10px] text-muted/60">
                  {isEn 
                    ? "Log and approve AI advice in Customer details page to start tracking ROI." 
                    : "销售人员在客户详情中采纳 AI 话术并顺利推进生命周期后，Outcomes 看板将实时呈现。"}
                </p>
              </div>
              <Link
                href="/customers"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-semibold"
              >
                {isEn ? "Go to Customers Workstation" : "前往客户工作台跟进"}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[10px] font-bold text-muted uppercase tracking-wider">
                    <th className="py-2.5">{t("customers.name")}</th>
                    <th className="py-2.5">{t("customers.stage")}</th>
                    <th className="py-2.5 text-right">{t("dashboard.savedValue")}</th>
                    <th className="py-2.5 text-right">{t("dashboard.savedHours")}</th>
                    <th className="py-2.5 text-right">{t("dashboard.time")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stats.outcomesLedger.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--sidebar-hover)]/40 transition-colors">
                      {/* 客户公司名称 */}
                      <td className="py-3 font-semibold text-foreground">
                        <Link href={`/customers/${o.customerId}`} className="hover:underline flex items-center gap-1">
                          {o.customerName}
                          <ArrowRight className="h-2.5 w-2.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
                        </Link>
                      </td>
                      
                      {/* 生命周期阶段 */}
                      <td className="py-3">
                        <StageBadge stage={o.stage} />
                      </td>
                      
                      {/* 挽回 Pipeline 金额 */}
                      <td className="py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        {o.savedValue > 0 ? formatCost(o.savedValue) : "-"}
                      </td>
                      
                      {/* 自动跟进节省时长 */}
                      <td className="py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        {o.savedHours > 0 ? `${o.savedHours} h` : "-"}
                      </td>
                      
                      {/* 转化发生时间 */}
                      <td className="py-3 text-right text-muted">
                        {new Date(o.createdAt).toLocaleDateString(isEn ? "en-US" : "zh-CN") + " " + new Date(o.createdAt).toLocaleTimeString(isEn ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
