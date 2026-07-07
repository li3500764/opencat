"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, History, Loader2, Trash2 } from "lucide-react";
import { FortuneHero } from "@/components/fortune-v2/fortune-hero";
import { FortuneFormModal } from "@/components/fortune-v2/fortune-form-modal";
import { FortuneLoading } from "@/components/fortune-v2/fortune-loading";
import { FortuneResult } from "@/components/fortune-v2/fortune-result";
import { extractFortuneCharts } from "@/lib/fortune/normalize";
import { buildFortuneReadingRequestBody, type FortuneReadingRequestDraft } from "@/lib/fortune/request";
import type { BaziChart, FortuneGender, FortuneMethod } from "@/lib/fortune/types";
import type { TarotChart } from "@/lib/fortune/tarot";
import type { ZiweiChart } from "@/lib/fortune/ziwei";
import type { ZhouyiTimeChart } from "@/lib/fortune/zhouyi";
import type { XiaoliurenChart } from "@/lib/fortune/xiaoliuren";

type Phase = "hero" | "form" | "loading" | "result" | "history";

interface HistoryItem {
  id: string;
  profileName: string;
  method?: FortuneMethod;
  summary?: string;
  createdAt: string;
}

interface ReadingDetail {
  id: string;
  profileName: string;
  gender: FortuneGender;
  birthDateTime: string;
  queryDateTime: string;
  locationName: string;
  chart: unknown;
  method?: FortuneMethod;
  baziChart?: BaziChart | null;
  zhouyiChart?: ZhouyiTimeChart;
  ziweiChart?: ZiweiChart;
  tarotChart?: TarotChart;
  xiaoliurenChart?: XiaoliurenChart;
  interpretation: string;
  model: string;
  createdAt: string;
}

interface FortuneResponse {
  readingId: string;
  method: FortuneMethod;
  chart: unknown;
  baziChart?: BaziChart;
  zhouyiChart?: ZhouyiTimeChart;
  ziweiChart?: ZiweiChart;
  tarotChart?: TarotChart;
  xiaoliurenChart?: XiaoliurenChart;
  interpretation: string;
}

// Star field generation
function generateStars(count: number) {
  let seed = 20260708;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${next() * 100}%`,
    top: `${next() * 100}%`,
    size: next() * 2 + 1,
    duration: `${next() * 4 + 2}s`,
    delay: `${next() * 3}s`,
  }));
}

function methodLabel(method?: FortuneMethod) {
  const map: Record<string, string> = {
    bazi: "四柱八字", ziwei: "紫微斗数", zhouyi: "周易时间卦", tarot: "塔罗牌阵", xiaoliuren: "小六壬",
  };
  return map[method || ""] || "四柱八字";
}

function formatDisplayDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      if (res.status === 524 || res.status === 504) return "模型解读超时，请换用更快的模型或稍后重试";
      return `${fallback}（HTTP ${res.status}）`;
    }
    const data = await res.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export default function FortuneV2Page() {
  const [phase, setPhase] = useState<Phase>("hero");
  const [selectedMethod, setSelectedMethod] = useState<FortuneMethod>("bazi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [baziChart, setBaziChart] = useState<BaziChart | null>(null);
  const [zhouyiChart, setZhouyiChart] = useState<ZhouyiTimeChart | null>(null);
  const [ziweiChart, setZiweiChart] = useState<ZiweiChart | null>(null);
  const [tarotChart, setTarotChart] = useState<TarotChart | null>(null);
  const [xiaoliurenChart, setXiaoliurenChart] = useState<XiaoliurenChart | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const stars = useMemo(() => generateStars(80), []);

  const handleSelectMethod = (method: FortuneMethod) => {
    setSelectedMethod(method);
    setPhase("form");
    setError(null);
  };

  const handleSubmit = async (data: FortuneReadingRequestDraft) => {
    setError(null);
    setIsSubmitting(true);
    setPhase("loading");

    try {
      const res = await fetch("/api/fortune/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFortuneReadingRequestBody(data)),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "生成测算失败"));
      const result = (await res.json()) as FortuneResponse;
      const charts = extractFortuneCharts(result);
      setBaziChart(charts.bazi);
      setZhouyiChart(charts.zhouyi || null);
      setZiweiChart(charts.ziwei || null);
      setTarotChart(charts.tarot || null);
      setXiaoliurenChart((result.xiaoliurenChart as XiaoliurenChart) || charts.xiaoliuren || null);
      setInterpretation(result.interpretation);
      setCurrentReadingId(result.readingId);
      setSelectedMethod(result.method);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成测算失败");
      setPhase("form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setPhase("hero");
    setBaziChart(null);
    setZhouyiChart(null);
    setZiweiChart(null);
    setTarotChart(null);
    setXiaoliurenChart(null);
    setInterpretation("");
    setCurrentReadingId(null);
    setError(null);
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/fortune/readings", { cache: "no-store" });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch { /* noop */ }
    finally { setIsLoadingHistory(false); }
  };

  const loadReading = async (id: string) => {
    try {
      const res = await fetch(`/api/fortune/readings/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("读取失败");
      const detail = (await res.json()) as ReadingDetail;
      const charts = extractFortuneCharts(detail);
      setBaziChart(charts.bazi);
      setZhouyiChart(charts.zhouyi || null);
      setZiweiChart(charts.ziwei || null);
      setTarotChart(charts.tarot || null);
      setXiaoliurenChart((detail.xiaoliurenChart as XiaoliurenChart) || charts.xiaoliuren || null);
      setInterpretation(detail.interpretation);
      setCurrentReadingId(detail.id);
      setSelectedMethod(detail.method || "bazi");
      setPhase("result");
    } catch {
      setError("读取历史测算失败");
    }
  };

  const deleteReading = async (id: string) => {
    if (!confirm("确定删除这条历史测算吗？")) return;
    try {
      const res = await fetch(`/api/fortune/readings/${id}`, { method: "DELETE" });
      if (res.ok) setHistory((items) => items.filter((i) => i.id !== id));
    } catch { /* noop */ }
  };

  return (
    <div className="fortune-page">
      {/* Star field background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="fortune-star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              ["--duration" as string]: star.duration,
              ["--delay" as string]: star.delay,
            }}
          />
        ))}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-400 backdrop-blur-xl">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10">
        {phase === "hero" && (
          <>
            {/* History button (top right) */}
            <div className="fixed right-4 top-4 z-20 flex gap-2">
              <button
                onClick={() => { loadHistory(); setPhase("history"); }}
                className="fortune-card flex items-center gap-2 px-4 py-2 text-sm text-[var(--fortune-text-muted)] transition-colors hover:text-white"
              >
                <History className="h-4 w-4" />
                历史记录
              </button>
            </div>
            <FortuneHero onSelectMethod={handleSelectMethod} />
          </>
        )}

        {phase === "form" && (
          <>
            <FortuneHero onSelectMethod={handleSelectMethod} />
            <FortuneFormModal
              method={selectedMethod}
              onClose={() => setPhase("hero")}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </>
        )}

        {phase === "loading" && (
          <FortuneLoading method={selectedMethod} />
        )}

        {phase === "result" && (
          <FortuneResult
            method={selectedMethod}
            baziChart={baziChart}
            zhouyiChart={zhouyiChart}
            ziweiChart={ziweiChart}
            tarotChart={tarotChart}
            xiaoliurenChart={xiaoliurenChart}
            interpretation={interpretation}
            readingId={currentReadingId}
            onBack={handleBack}
          />
        )}

        {phase === "history" && (
          <HistoryPanel
            history={history}
            isLoading={isLoadingHistory}
            onBack={() => setPhase("hero")}
            onLoad={loadReading}
            onDelete={deleteReading}
            onRefresh={loadHistory}
          />
        )}
      </div>
    </div>
  );
}

function HistoryPanel({ history, isLoading, onBack, onLoad, onDelete, onRefresh }: {
  history: HistoryItem[]; isLoading: boolean;
  onBack: () => void; onLoad: (id: string) => void;
  onDelete: (id: string) => void; onRefresh: () => void;
}) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--fortune-text-muted)] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> 返回
          </button>
          <button onClick={onRefresh} className="text-[var(--fortune-text-muted)] hover:text-white">
            <Loader2 className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-white">历史记录</h2>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--fortune-text-muted)]" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-20 text-center">
            <History className="mx-auto mb-4 h-12 w-12 text-[var(--fortune-text-muted)]" />
            <p className="text-sm text-[var(--fortune-text-muted)]">暂无历史测算</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="fortune-card flex items-stretch group" style={{ "--card-accent": "rgba(255,255,255,0.1)" } as React.CSSProperties}>
                <button onClick={() => onLoad(item.id)} className="flex-1 px-4 py-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{item.profileName}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--fortune-bazi-bg)", color: "var(--fortune-bazi)" }}>
                      {methodLabel(item.method)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--fortune-text-muted)]">
                    {item.summary || "摘要"} · {formatDisplayDate(item.createdAt)}
                  </p>
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="flex w-10 items-center justify-center border-l border-[var(--fortune-border)] text-[var(--fortune-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
