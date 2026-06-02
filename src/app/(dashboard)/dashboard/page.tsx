// ============================================================
// OpenCat 个人 AI 生产力与 API 用量大盘 (重构版)
// ============================================================
//
// 职责：
//   1. 渲染用户个人 AI 核心资产与用量统计卡片（对话数、消息数、Token 用量与配额百分比、总花费）。
//   2. 升级纯 SVG 折线趋势图，支持动态一键切换展示“近 14 天 Token 消耗趋势”、“API 花费趋势”与“消息生成趋势”。
//   3. 使用 `DonutChart` 圆环图直观渲染“常用大语言模型 (LLM) 消耗分布占比”。
//   4. 展示 `ActivityTable` API 真实审计流水账目，包括具体 Prompt/Completion token 消耗与美元计费。
//   5. 适配炫酷的深浅色 UI，融合优雅的渐变和精细 hover 微动画。
//
// ============================================================

"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Bot,
  Cpu,
  Coins,
  Loader2,
  RefreshCw,
  TrendingUp,
  Sparkles,
  Database,
  BrainCircuit,
  ArrowRight,
  Gauge
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { StatCard, LineChart, DonutChart, ActivityTable } from "@/components/dashboard";

// 强类型声明
interface UserStats {
  name: string | null;
  email: string;
  tokenQuota: number;
  tokenUsed: number;
}

interface OverviewCount {
  totalConversations: number;
  totalMessages: number;
  totalAgents: number;
  totalKnowledgeBases: number;
  totalMemories: number;
}

interface DailyTrendPoint {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
}

interface ModelUsageItem {
  model: string;
  provider: string;
  tokens: number;
  cost: number;
  count: number;
}

interface ActivityLogItem {
  id: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

interface StatsData {
  user: UserStats;
  overview: OverviewCount;
  totalTokens: number;
  totalCost: number;
  dailyRoiTrend: DailyTrendPoint[];
  modelDistribution: ModelUsageItem[];
  recentActivity: ActivityLogItem[];
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 折线图当前展示指标状态："tokens" (Token 消耗) | "cost" (API 费用) | "messages" (请求数/消息数)
  const [chartMetric, setChartMetric] = useState<"tokens" | "cost" | "messages">("tokens");

  // 获取 AI 生产力大盘统计包
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
          className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  // 配额比例计算
  const quotaPercentage = stats.user.tokenQuota > 0
    ? Math.min(Math.round((stats.user.tokenUsed / stats.user.tokenQuota) * 100), 100)
    : 0;

  // 格式化 token 数
  const formatTokensCount = (t: number) => {
    if (t >= 1000000) return `${(t / 1000000).toFixed(1)} M`;
    if (t >= 1000) return `${(t / 1000).toFixed(1)} K`;
    return t.toLocaleString();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background scrollbar-thin">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-6">
        
        {/* ---- 页面标题 & 刷新按钮 ---- */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent animate-pulse" />
              {t("dashboard.title")}
            </h1>
            <p className="text-xs text-muted">
              {isEn 
                ? "OpenCat Personal AI Productivity & Cost Analytics Dashboard" 
                : "OpenCat 个人 AI 提效生产力与用量账目大盘分析"}
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

        {/* ================= 第一板块：四大个人核心 AI 指标卡 ================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: 活跃对话数 */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-accent/20 transition-all duration-200 group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {t("dashboard.conversations")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {stats.overview.totalConversations}
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                {isEn ? "Active chat sandboxes" : "个活跃调试沙箱"}
              </p>
            </div>
          </div>

          {/* Card 2: 消息总条数 */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-accent/20 transition-all duration-200 group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {isEn ? "Messages" : "消息交互数"}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                {stats.overview.totalMessages} <span className="text-[10px] font-semibold text-muted">{t("dashboard.messages")}</span>
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                {isEn ? "Total prompts & replies" : "累计提示词与回答生成"}
              </p>
            </div>
          </div>

          {/* Card 3: Token 用量配额比 (金色琥珀带进度条) */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Cpu className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">
                  {t("dashboard.tokenUsage")}
                </p>
                <h4 className="text-lg font-black text-foreground mt-0.5 truncate">
                  {formatTokensCount(stats.user.tokenUsed)}
                </h4>
              </div>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 shrink-0">
                {quotaPercentage}%
              </span>
            </div>
            {/* 极细微进度条 */}
            <div className="mt-3.5 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-amber-500/10 border border-amber-500/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
                  style={{ width: `${quotaPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted font-medium">
                <span>{isEn ? "Used tokens" : "已用容量"}</span>
                <span>{isEn ? `Quota: ${formatTokensCount(stats.user.tokenQuota)}` : `配额 ${formatTokensCount(stats.user.tokenQuota)}`}</span>
              </div>
            </div>
          </div>

          {/* Card 4: 总花费 API 费用 */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-red-500/30 transition-all duration-200 group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 group-hover:scale-105 transition-transform">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">
                {t("dashboard.totalCost")}
              </p>
              <h4 className="text-xl font-black text-foreground mt-0.5">
                ${stats.totalCost.toFixed(4)}
              </h4>
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                {isEn ? "Estimated API bill" : "折算大模型消费花费"}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 第二板块：14 天 Token/费用 趋势折线图 (支持指标动态切换) ================= */}
        <div className="relative rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-accent" />
              {t("dashboard.usageTrend")}
            </h3>
            
            {/* 指标选择切换 tab */}
            <div className="flex rounded-lg bg-background-secondary p-1 border border-border">
              <button
                onClick={() => setChartMetric("tokens")}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                  chartMetric === "tokens"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Tokens
              </button>
              <button
                onClick={() => setChartMetric("cost")}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                  chartMetric === "cost"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {isEn ? "Cost" : "API 账单"}
              </button>
              <button
                onClick={() => setChartMetric("messages")}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                  chartMetric === "messages"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {isEn ? "Requests" : "对话请求数"}
              </button>
            </div>
          </div>

          {/* 渲染纯手绘 SVG 折线图 */}
          <LineChart
            data={stats.dailyRoiTrend}
            dataKey={chartMetric}
            title={
              chartMetric === "tokens" 
                ? (isEn ? "14-day cumulative Token Consumption" : "近 14 天累计 Token 消耗走势") 
                : chartMetric === "cost" 
                ? (isEn ? "14-day API cost (USD)" : "近 14 天 API 折算消费金额 ($)") 
                : (isEn ? "14-day dialog requests" : "近 14 天日发起大语言模型请求次数")
            }
            color={chartMetric === "tokens" ? "#f59e0b" : chartMetric === "cost" ? "#dc2626" : "#3b82f6"} // 琥珀色 / 红色 / 蓝色
            emptyText={isEn ? "No usage recorded in past 14 days" : "近 14 天暂无任何大模型对话数据记录"}
          />
        </div>

        {/* ================= 第三板块：模型分布占比 & 知识库资产面板 (并排两列) ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* (A) 模型分布占比 (DonutChart) */}
          <div className="shadow-sm hover:border-accent/10 transition-all">
            <DonutChart
              data={stats.modelDistribution}
              title={t("dashboard.modelDistribution")}
              totalLabel={isEn ? "Total Tokens" : "已用 Token"}
              emptyText={isEn ? "No model data yet. Chat with models to populate!" : "暂无模型消耗数据，请先与 AI 助手对话。"}
            />
          </div>

          {/* (B) 知识与记忆资产面包 (AI Assets Workspace Card) */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
                <span>{isEn ? "Smart Assets Overview" : "智能资产概览"}</span>
                <span className="rounded bg-accent/10 px-2 py-0.5 text-[9px] font-semibold text-accent">
                  Active
                </span>
              </h3>
              <p className="text-[10px] text-muted mt-1">
                {isEn 
                  ? "AI Agents, private knowledge bases, and long-term vector memories" 
                  : "个人名下的自定义 Agent 智能体、私有 RAG 向量知识库以及长期记忆沉淀"}
              </p>
            </div>

            {/* 资产仪表卡 */}
            <div className="grid grid-cols-3 gap-2.5 my-2">
              <div className="rounded-xl bg-background-secondary p-3 text-center border border-border">
                <BrainCircuit className="mx-auto h-4 w-4 text-purple-500 mb-1" />
                <span className="block text-[10px] text-muted font-medium">{t("sidebar.agents")}</span>
                <span className="text-base font-extrabold text-foreground">{stats.overview.totalAgents}</span>
              </div>
              
              <div className="rounded-xl bg-background-secondary p-3 text-center border border-border">
                <Database className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
                <span className="block text-[10px] text-muted font-medium">{isEn ? "Vector KB" : "向量知识库"}</span>
                <span className="text-base font-extrabold text-foreground">{stats.overview.totalKnowledgeBases}</span>
              </div>
              
              <div className="rounded-xl bg-background-secondary p-3 text-center border border-border">
                <Gauge className="mx-auto h-4 w-4 text-amber-500 mb-1" />
                <span className="block text-[10px] text-muted font-medium">{isEn ? "Memories" : "关联长期记忆"}</span>
                <span className="text-base font-extrabold text-foreground">{stats.overview.totalMemories}</span>
              </div>
            </div>

            <div className="text-[10px] text-muted flex items-center justify-between pt-2 border-t border-border">
              <span>{isEn ? "Ready to customize?" : "想要打造个人 AI 专家？"}</span>
              <Link
                href="/customers"
                className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline font-semibold"
              >
                {isEn ? "Configure smart workspace" : "前往智能工作台配置"}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

        </div>

        {/* ================= 第四板块：最近真实 API 调用审计账本 ================= */}
        <div className="shadow-sm">
          <ActivityTable data={stats.recentActivity} />
        </div>

      </div>
    </div>
  );
}
