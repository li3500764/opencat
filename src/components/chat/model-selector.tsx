// ============================================================
// 模型选择器
// ============================================================
// 下拉选模型，按 Provider 分组，当前选中模型高亮

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { PROVIDERS } from "@/lib/llm/registry";
import type { ModelInfo } from "@/lib/llm/types";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 当前选中的模型信息
  const current = PROVIDERS.flatMap((p) => p.models).find((m) => m.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--sidebar-hover)]"
      >
        <span className="text-muted">{current?.name || value}</span>
        <ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
          style={{ boxShadow: "var(--input-shadow), 0 4px 12px rgba(0,0,0,0.08)" }}
        >
          {PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {provider.name}
              </p>
              {provider.models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => { onChange(model.id); setOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    value === model.id
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground/80 hover:bg-[var(--sidebar-hover)]"
                  }`}
                >
                  <span>{model.name}</span>
                  <span className="text-[10px] text-muted">
                    ${model.inputPrice}/{model.outputPrice}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
