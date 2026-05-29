// ============================================================
// 模型选择器（支持从后端 API 动态获取 Model 列表）
// ============================================================
// 下拉选模型，按自定义 Provider 分组，当前选中模型高亮
//

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Pencil, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

interface UserModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerLabel: string;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);  // 是否处于自定义输入模式
  const [customInput, setCustomInput] = useState("");     // 自定义输入框的值
  const [models, setModels] = useState<UserModelInfo[]>([]); // 动态获取的模型列表
  
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  // ---- 动态从后端加载模型列表 ----
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch("/api/models");
        if (res.ok) {
          const data = await res.json();
          setModels(data);
        }
      } catch (err) {
        console.error("加载模型列表失败:", err);
      }
    }
    fetchModels();
  }, []);

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

  // 当前选中的模型信息
  const current = models.find((m) => m.id === value);

  // 按 Provider 备注名称进行高级分组
  const grouped = models.reduce((acc, m) => {
    const key = m.providerLabel || "自定义提供商";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, UserModelInfo[]>);

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
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--sidebar-hover)] bg-card shadow-sm"
      >
        <span className="text-muted max-w-[160px] truncate">
          {current?.name || (value ? value : "未配置模型")}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg animate-scaleIn"
          style={{ boxShadow: "var(--input-shadow), 0 4px 12px rgba(0,0,0,0.08)" }}
        >
          {models.length === 0 ? (
            /* ---- 无任何激活密钥模型时的 Premium 级下拉警告与引导跳转 ---- */
            <div className="flex flex-col items-center text-center p-1.5 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger animate-pulse">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">无可用 AI 模型</p>
                <p className="text-[10px] text-muted leading-relaxed">
                  系统检测到你尚未在【设置】页面配置并激活任何 OpenAI 兼容格式的密钥。
                </p>
              </div>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 active:scale-[0.98] transition-all"
              >
                前往配置密钥 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            /* ---- 动态渲染用户自定义模型列表 ---- */
            <>
              <div className="max-h-[260px] overflow-y-auto">
                {Object.entries(grouped).map(([providerLabel, providerModels]) => (
                  <div key={providerLabel} className="mb-2 last:mb-0">
                    <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted/50 border-b border-border/10 mb-1">
                      {providerLabel}
                    </p>
                    {providerModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => { onChange(model.id); setOpen(false); setCustomMode(false); }}
                        className={`flex w-full flex-col justify-center rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                          value === model.id
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-foreground/80 hover:bg-[var(--sidebar-hover)]"
                        }`}
                      >
                        <span>{model.name}</span>
                        <span className="text-[9px] text-muted/40 font-mono mt-0.5">{model.id}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* ---- 分割线 ---- */}
              <div className="my-1.5 border-t border-border" />

              {/* ---- 自定义输入区 ---- */}
              {customMode ? (
                <div className="px-0.5 pb-0.5">
                  <input
                    ref={inputRef}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomSubmit();
                      if (e.key === "Escape") { setCustomMode(false); setCustomInput(""); }
                    }}
                    placeholder={t('chat.enterModelId')}
                    className="w-full rounded-lg border border-border bg-input-bg px-2.5 py-1.5 text-xs outline-none focus:border-accent/50 placeholder:text-muted/40"
                  />
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      onClick={handleCustomSubmit}
                      disabled={!customInput.trim()}
                      className="flex-1 rounded-lg bg-foreground px-2 py-1 text-[10px] font-medium text-background hover:opacity-80 disabled:opacity-40"
                    >
                      {t('chat.useThisModel')}
                    </button>
                    <button
                      onClick={() => { setCustomMode(false); setCustomInput(""); }}
                      className="rounded-lg px-2 py-1 text-[10px] text-muted hover:text-foreground"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCustomMode(true)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-xs text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{t('chat.customModelId')}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

