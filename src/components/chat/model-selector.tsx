// ============================================================
// 模型选择器（支持自定义 Model ID）
// ============================================================
// 下拉选模型，按 Provider 分组，当前选中模型高亮
//
// ★ 关键特性：
// 1. 预设模型列表 — 按 Provider 分组，显示价格
// 2. 自定义输入 — 用户可以直接输入任意 Model ID
//    场景：第三方代理平台的模型名可能不在预设列表里
//    比如 heiyu 代理的 gpt-5.4 和 OpenAI 官方的 gpt-5.4 是同一个 ID
//    但如果用户的代理平台用了别名（如 "my-custom-model"），也能直接输入

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { PROVIDERS } from "@/lib/llm/registry";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);  // 是否处于自定义输入模式
  const [customInput, setCustomInput] = useState("");     // 自定义输入框的值
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 自定义模式打开时自动聚焦
  useEffect(() => {
    if (customMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [customMode]);

  // 当前选中的模型信息（可能不在预设列表里）
  const current = PROVIDERS.flatMap((p) => p.models).find((m) => m.id === value);

  // 提交自定义 Model ID
  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setCustomInput("");
      setCustomMode(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--sidebar-hover)]"
      >
        {/* 如果是预设模型显示名称，否则直接显示 ID */}
        <span className="text-muted max-w-[160px] truncate">{current?.name || value}</span>
        <ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
          style={{ boxShadow: "var(--input-shadow), 0 4px 12px rgba(0,0,0,0.08)" }}
        >
          {/* ---- 预设模型列表 ---- */}
          <div className="max-h-[320px] overflow-y-auto">
            {PROVIDERS.map((provider) => (
              <div key={provider.id}>
                <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {provider.name}
                </p>
                {provider.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { onChange(model.id); setOpen(false); setCustomMode(false); }}
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

          {/* ---- 分割线 ---- */}
          <div className="my-1.5 border-t border-border" />

          {/* ---- 自定义输入区 ---- */}
          {customMode ? (
            <div className="px-1.5 pb-1">
              <input
                ref={inputRef}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                  if (e.key === "Escape") { setCustomMode(false); setCustomInput(""); }
                }}
                placeholder="Enter model ID, e.g. gpt-5.4"
                className="w-full rounded-lg border border-border bg-input-bg px-2.5 py-2 text-xs outline-none focus:border-accent/50 placeholder:text-muted/40"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim()}
                  className="flex-1 rounded-lg bg-foreground px-2 py-1.5 text-[10px] font-medium text-background hover:opacity-80 disabled:opacity-40"
                >
                  Use this model
                </button>
                <button
                  onClick={() => { setCustomMode(false); setCustomInput(""); }}
                  className="rounded-lg px-2 py-1.5 text-[10px] text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCustomMode(true)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              <span>Custom Model ID</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
