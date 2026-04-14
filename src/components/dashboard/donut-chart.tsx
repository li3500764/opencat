// ============================================================
// SVG 环形图组件（Donut Chart）
// ============================================================
// 纯 SVG，用 stroke-dasharray 技巧画弧形
// 展示模型使用占比
//
// 原理：
// 1. 每个模型占一段弧形（SVG circle 的 strokeDasharray）
// 2. 通过 strokeDashoffset 控制起始位置
// 3. 中间显示总量

"use client";

import { useState } from "react";

interface ModelData {
  model: string;
  provider: string;
  tokens: number;
  cost: number;
  count: number;
}

interface DonutChartProps {
  data: ModelData[];
  title?: string;
  emptyText?: string;    // 无数据时的提示文案
  totalLabel?: string;   // 中心 "total tokens" 文案
}

// 预定义配色（不用紫色，走暖色系）
const COLORS = [
  "#d97706", // amber-600
  "#0891b2", // cyan-600
  "#059669", // emerald-600
  "#dc2626", // red-600
  "#ca8a04", // yellow-600
  "#2563eb", // blue-600
  "#9333ea", // 只有在模型很多时才会用到
  "#64748b", // slate-500
];

// SVG 环形图参数
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 70;
const STROKE_WIDTH = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ data, title = "Model Usage", emptyText = "No model data yet", totalLabel = "total tokens" }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-card-border bg-card p-5 text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  const totalTokens = data.reduce((sum, d) => sum + d.tokens, 0);

  // 计算每个模型的弧形参数
  let cumulativeOffset = 0;
  const segments = data.map((d, i) => {
    const percentage = totalTokens > 0 ? d.tokens / totalTokens : 0;
    const dashLength = percentage * CIRCUMFERENCE;
    const offset = cumulativeOffset;
    cumulativeOffset += dashLength;

    return {
      ...d,
      percentage,
      dashLength,
      // strokeDashoffset 从 12 点方向开始（默认从 3 点，减 25% 周长旋转到 12 点）
      dashOffset: CIRCUMFERENCE * 0.25 - offset,
      color: COLORS[i % COLORS.length],
    };
  });

  // 格式化 token 数
  const formatTokens = (t: number) => {
    if (t >= 1000000) return `${(t / 1000000).toFixed(1)}M`;
    if (t >= 1000) return `${(t / 1000).toFixed(1)}K`;
    return t.toString();
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>

      <div className="flex items-center gap-6">
        {/* 左侧：环形图 */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* 背景环 */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="var(--border)"
              strokeWidth={STROKE_WIDTH}
            />

            {/* 数据弧形 */}
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredIndex === i ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                strokeDasharray={`${seg.dashLength} ${CIRCUMFERENCE - seg.dashLength}`}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
                className="cursor-pointer transition-all duration-200"
                opacity={hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}

            {/* 中心文字 */}
            <text
              x={CENTER}
              y={CENTER - 8}
              textAnchor="middle"
              fontSize="18"
              fontWeight="700"
              fill="var(--foreground)"
            >
              {formatTokens(totalTokens)}
            </text>
            <text
              x={CENTER}
              y={CENTER + 10}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted)"
            >
              {totalLabel}
            </text>
          </svg>
        </div>

        {/* 右侧：图例列表 */}
        <div className="flex-1 space-y-2">
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                hoveredIndex === i ? "bg-[var(--sidebar-hover)]" : ""
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 色块 */}
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              {/* 模型名 */}
              <span className="flex-1 truncate font-medium">{seg.model}</span>
              {/* 百分比 */}
              <span className="text-muted">
                {(seg.percentage * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
