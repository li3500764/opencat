// ============================================================
// 最近活动表格组件
// ============================================================
// 展示最近 20 条 API 调用记录

"use client";

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
  title?: string;
}

// Provider 配色映射（跟 Settings 页面一致）
const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d97706",
  deepseek: "#0891b2",
  google: "#2563eb",
  custom: "#64748b",
};

export function ActivityTable({ data, title = "Recent Activity" }: ActivityTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium">{title}</h3>
        <p className="py-6 text-center text-xs text-muted">No activity yet</p>
      </div>
    );
  }

  // 格式化时间（相对时间）
  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // 格式化 token 数
  const formatTokens = (t: number) => {
    if (t >= 1000) return `${(t / 1000).toFixed(1)}K`;
    return t.toString();
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-2 pr-4 font-medium">Model</th>
              <th className="pb-2 pr-4 font-medium">Provider</th>
              <th className="pb-2 pr-4 text-right font-medium">Input</th>
              <th className="pb-2 pr-4 text-right font-medium">Output</th>
              <th className="pb-2 pr-4 text-right font-medium">Total</th>
              <th className="pb-2 pr-4 text-right font-medium">Cost</th>
              <th className="pb-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-[var(--sidebar-hover)]"
              >
                {/* 模型名 */}
                <td className="py-2.5 pr-4">
                  <span className="font-medium">{item.model}</span>
                </td>

                {/* Provider 标签 */}
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

                {/* Input tokens */}
                <td className="py-2.5 pr-4 text-right text-muted">
                  {formatTokens(item.promptTokens)}
                </td>

                {/* Output tokens */}
                <td className="py-2.5 pr-4 text-right text-muted">
                  {formatTokens(item.completionTokens)}
                </td>

                {/* Total tokens */}
                <td className="py-2.5 pr-4 text-right font-medium">
                  {formatTokens(item.totalTokens)}
                </td>

                {/* 花费 */}
                <td className="py-2.5 pr-4 text-right">
                  <span className="text-accent">${item.cost.toFixed(4)}</span>
                </td>

                {/* 时间 */}
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
