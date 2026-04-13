// ============================================================
// AgentSelector — Agent 选择器（Day 5）
// ============================================================
//
// 功能：在对话顶栏选择使用哪个 Agent
//
// 两种模式：
//   1. "none" — 不使用 Agent，退化为普通聊天（默认行为，兼容 Day 1-4）
//   2. 选择一个自定义 Agent — 使用该 Agent 的系统提示词、工具、模型配置
//
// UI：与 ModelSelector 类似的下拉菜单风格
// ============================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Bot, Wrench } from "lucide-react";

// ---------- Agent 数据类型（从 API 返回） ----------
export interface AgentOption {
  id: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
  isOrchestrator: boolean;
}

interface AgentSelectorProps {
  // 当前选中的 agentId，null 表示不使用 Agent
  value: string | null;
  // 选中后的回调
  onChange: (agentId: string | null) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  // ---- 状态 ----
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // ---- 点击外部关闭 ----
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---- 获取 Agent 列表 ----
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        // 忽略，降级为空列表
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  // ---- 当前选中的 Agent ----
  const current = agents.find((a) => a.id === value);

  return (
    <div ref={ref} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--sidebar-hover)]"
      >
        <Bot className="h-3 w-3 text-muted" />
        <span className="text-muted">
          {current ? current.name : "Default"}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
          style={{ boxShadow: "var(--input-shadow), 0 4px 12px rgba(0,0,0,0.08)" }}
        >
          {/* "不使用 Agent" 选项 */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
              value === null
                ? "bg-accent/10 text-accent font-medium"
                : "text-foreground/80 hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <span className="flex-1">Default (no agent)</span>
            <span className="text-[10px] text-muted">plain chat</span>
          </button>

          {/* 分隔线 */}
          {agents.length > 0 && (
            <div className="my-1 border-t border-border/50" />
          )}

          {/* Agent 列表 */}
          {loading ? (
            <p className="px-2.5 py-3 text-center text-[11px] text-muted">Loading...</p>
          ) : agents.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-[11px] text-muted">
              No agents yet. Create one in Settings.
            </p>
          ) : (
            <>
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Custom Agents
              </p>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => { onChange(agent.id); setOpen(false); }}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    value === agent.id
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground/80 hover:bg-[var(--sidebar-hover)]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{agent.name}</span>
                    {agent.description && (
                      <span className="block truncate text-[10px] text-muted mt-0.5">
                        {agent.description}
                      </span>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted">
                    <Wrench className="h-2.5 w-2.5" />
                    {agent.tools.length}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
