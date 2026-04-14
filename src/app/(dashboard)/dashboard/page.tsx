// ============================================================
// Dashboard 数据看板页面
// ============================================================
// 展示平台使用统计：
// 1. 概览卡片（对话/消息/Token/花费）
// 2. Token 用量趋势折线图（14 天）
// 3. 模型使用占比环形图
// 4. 最近活动表格
//
// 数据来源：GET /api/stats 一个接口返回全部数据

"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  MessagesSquare,
  Zap,
  DollarSign,
  Bot,
  Database,
  Brain,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { StatCard, LineChart, DonutChart, ActivityTable } from "@/components/dashboard";

// ---- 类型定义 ----
interface StatsData {
  overview: {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    totalAgents: number;
    totalKnowledgeBases: number;
    totalMemories: number;
  };
  tokenUsage: {
    quota: number;
    used: number;
    percentage: number;
    plan: string;
  };
  dailyUsage: Array<{
    date: string;
    tokens: number;
    cost: number;
    messages: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    provider: string;
    tokens: number;
    cost: number;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    createdAt: string;
  }>;
}

// ---- 格式化工具 ----
function formatTokens(t: number): string {
  if (t >= 1000000) return `${(t / 1000000).toFixed(1)}M`;
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`;
  return t.toString();
}

function formatCost(c: number): string {
  return `$${c.toFixed(4)}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // ---- Loading 状态 ----
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  // ---- 错误状态 ----
  if (error || !stats) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-danger">{error || "Failed to load"}</p>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const { overview, tokenUsage, dailyUsage, modelBreakdown, recentActivity } = stats;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* ---- 页面标题 ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-xs text-muted">
              Platform usage overview and analytics
            </p>
          </div>
          <button
            onClick={fetchStats}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {/* ---- 概览卡片（第一行：4 个核心指标） ---- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Conversations"
            value={overview.totalConversations}
            subtitle={`${overview.totalMessages} messages`}
            icon={MessageSquare}
          />
          <StatCard
            label="Token Usage"
            value={formatTokens(tokenUsage.used)}
            subtitle={`${tokenUsage.percentage}% of ${formatTokens(tokenUsage.quota)} quota`}
            icon={Zap}
          />
          <StatCard
            label="Total Cost"
            value={formatCost(overview.totalCost)}
            subtitle={`${overview.totalTokens.toLocaleString()} total tokens`}
            icon={DollarSign}
          />
          <StatCard
            label="Resources"
            value={overview.totalAgents}
            subtitle={`${overview.totalKnowledgeBases} KB, ${overview.totalMemories} memories`}
            icon={Bot}
          />
        </div>

        {/* ---- Token 配额进度条 ---- */}
        <div className="rounded-xl border border-card-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Token Quota</h3>
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                {tokenUsage.plan}
              </span>
            </div>
            <span className="text-xs text-muted">
              {formatTokens(tokenUsage.used)} / {formatTokens(tokenUsage.quota)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(tokenUsage.percentage, 100)}%`,
                backgroundColor:
                  tokenUsage.percentage > 90
                    ? "var(--danger)"
                    : tokenUsage.percentage > 70
                      ? "#ca8a04"
                      : "var(--accent)",
              }}
            />
          </div>
        </div>

        {/* ---- 图表区域（折线图 + 环形图 并排） ---- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 折线图占 2 列 */}
          <div className="lg:col-span-2">
            <LineChart
              data={dailyUsage}
              dataKey="tokens"
              title="Token Usage Trend (14 days)"
            />
          </div>
          {/* 环形图占 1 列 */}
          <div>
            <DonutChart data={modelBreakdown} title="Model Distribution" />
          </div>
        </div>

        {/* ---- 最近活动表格 ---- */}
        <ActivityTable data={recentActivity} />
      </div>
    </div>
  );
}
