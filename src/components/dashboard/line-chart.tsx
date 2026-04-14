// ============================================================
// SVG 折线图组件
// ============================================================
// 纯 SVG 手绘，不依赖第三方图表库
// 用于展示 14 天 Token 使用趋势
//
// 实现思路：
// 1. 把数据点映射到 SVG 坐标系
// 2. 用 <polyline> 画折线
// 3. 用 <linearGradient> + <polygon> 画面积填充
// 4. 鼠标 hover 显示 tooltip

"use client";

import { useState } from "react";

interface DataPoint {
  date: string;    // "2026-04-01"
  tokens: number;
  cost: number;
  messages: number;
}

interface LineChartProps {
  data: DataPoint[];
  dataKey?: "tokens" | "messages" | "cost";  // 展示哪个指标
  title?: string;
  color?: string;  // 折线颜色（CSS 变量或 hex）
}

// SVG 画布参数
const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };

// 绘图区域
const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

export function LineChart({
  data,
  dataKey = "tokens",
  title = "Token Usage (14 days)",
  color = "var(--accent)",
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-card-border bg-card p-5 text-sm text-muted">
        No usage data yet
      </div>
    );
  }

  // 取值
  const values = data.map((d) => d[dataKey] as number);
  const maxVal = Math.max(...values, 1); // 至少 1 避免除零

  // 数据点 → SVG 坐标
  const points = values.map((val, i) => ({
    x: PADDING.left + (i / Math.max(data.length - 1, 1)) * plotWidth,
    y: PADDING.top + plotHeight - (val / maxVal) * plotHeight,
    val,
    date: data[i].date,
  }));

  // polyline 路径
  const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");

  // 面积填充路径（闭合到底部）
  const areaPath = [
    `${points[0].x},${PADDING.top + plotHeight}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${PADDING.top + plotHeight}`,
  ].join(" ");

  // Y 轴刻度（5 个）
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxVal / 4) * i;
    const y = PADDING.top + plotHeight - (val / maxVal) * plotHeight;
    return { val, y };
  });

  // 格式化数值
  const formatVal = (v: number) => {
    if (dataKey === "cost") return `$${v.toFixed(2)}`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toString();
  };

  // 格式化日期（只显示月/日）
  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        style={{ maxHeight: 220 }}
      >
        <defs>
          {/* 面积渐变填充 */}
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y 轴网格线 + 刻度 */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={tick.y}
              x2={CHART_WIDTH - PADDING.right}
              y2={tick.y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "0" : "4,4"}
            />
            <text
              x={PADDING.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
            >
              {formatVal(tick.val)}
            </text>
          </g>
        ))}

        {/* X 轴日期标签（隔一个显示，避免拥挤） */}
        {points.map((p, i) =>
          i % 2 === 0 || i === points.length - 1 ? (
            <text
              key={i}
              x={p.x}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {formatDate(p.date)}
            </text>
          ) : null
        )}

        {/* 面积填充 */}
        <polygon points={areaPath} fill="url(#areaGradient)" />

        {/* 折线 */}
        <polyline
          points={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 数据点圆点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={hoveredIndex === i ? color : "var(--card)"}
            stroke={color}
            strokeWidth="2"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <g>
            {/* 竖线 */}
            <line
              x1={points[hoveredIndex].x}
              y1={PADDING.top}
              x2={points[hoveredIndex].x}
              y2={PADDING.top + plotHeight}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.4"
            />
            {/* 背景矩形 */}
            <rect
              x={points[hoveredIndex].x - 50}
              y={points[hoveredIndex].y - 36}
              width="100"
              height="26"
              rx="6"
              fill="var(--foreground)"
              opacity="0.9"
            />
            {/* 文字 */}
            <text
              x={points[hoveredIndex].x}
              y={points[hoveredIndex].y - 20}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--background)"
            >
              {formatDate(points[hoveredIndex].date)}: {formatVal(points[hoveredIndex].val)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
