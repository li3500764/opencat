// ============================================================
// 统计卡片组件
// ============================================================
// 显示一个数值 + 标签的统计卡片
// 可选：副标题、图标、趋势

"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;           // 标签文字（如"Total Conversations"）
  value: string | number;  // 主数值
  subtitle?: string;       // 副标题（如"$1.23 spent"）
  icon: LucideIcon;        // lucide 图标组件
  accentColor?: string;    // 图标背景色 class（默认琥珀色）
}

export function StatCard({ label, value, subtitle, icon: Icon, accentColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        {/* 左侧：文字内容 */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted">{subtitle}</p>
          )}
        </div>

        {/* 右侧：图标 */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentColor || "var(--accent)", opacity: 0.12 }}
        >
          <Icon
            className="h-5 w-5"
            style={{ color: accentColor || "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
