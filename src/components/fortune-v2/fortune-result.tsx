"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Share2, MessageCircle, Send, Loader2, Trash2 } from "lucide-react";
import type { FortuneMethod } from "@/lib/fortune/types";
import type { BaziChart } from "@/lib/fortune/types";
import type { ZhouyiTimeChart } from "@/lib/fortune/zhouyi";
import type { ZiweiChart } from "@/lib/fortune/ziwei";
import type { TarotChart } from "@/lib/fortune/tarot";
import type { XiaoliurenChart } from "@/lib/fortune/xiaoliuren";
import { ModelSelector } from "@/components/chat/model-selector";
import { ShareModal } from "@/components/fortune/share-modal";

const METHOD_META: Record<FortuneMethod, { accent: string; glow: string; label: string }> = {
  bazi: { accent: "var(--fortune-bazi)", glow: "var(--fortune-bazi-glow)", label: "四柱八字" },
  ziwei: { accent: "var(--fortune-ziwei)", glow: "var(--fortune-ziwei-glow)", label: "紫微斗数" },
  zhouyi: { accent: "var(--fortune-zhouyi)", glow: "var(--fortune-zhouyi-glow)", label: "周易时间卦" },
  tarot: { accent: "var(--fortune-tarot)", glow: "var(--fortune-tarot-glow)", label: "塔罗牌阵" },
  xiaoliuren: { accent: "var(--fortune-xiaoliuren)", glow: "var(--fortune-xiaoliuren-glow)", label: "小六壬" },
};

interface ConsultMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface FortuneResultProps {
  method: FortuneMethod;
  baziChart?: BaziChart | null;
  zhouyiChart?: ZhouyiTimeChart | null;
  ziweiChart?: ZiweiChart | null;
  tarotChart?: TarotChart | null;
  xiaoliurenChart?: XiaoliurenChart | null;
  interpretation: string;
  readingId: string | null;
  onBack: () => void;
}

function elementLabel(e: string) {
  return ({ wood: "木", fire: "火", earth: "土", metal: "金", water: "水" } as Record<string, string>)[e] || e;
}

function TypewriterText({ text, accent }: { text: string; accent: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
    const timer = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(timer);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, 18);
    return () => clearInterval(timer);
  }, [text]);

  const lines = displayed.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const clean = line.replace(/\*\*/g, "").replace(/#/g, "");
        if (/^一、|^二、|^三、|^四、|^五、|^六、|^七、|^八、/.test(clean)) {
          return <h4 key={i} className="mt-4 mb-1 text-base font-bold text-white">{clean}</h4>;
        }
        return <p key={i} className="text-[var(--fortune-text-muted)] leading-7">{clean}</p>;
      })}
      {!done && (
        <span className="inline-block h-4 w-0.5" style={{ background: accent, animation: "fortune-cursor 0.8s step-end infinite" }} />
      )}
    </div>
  );
}

export function FortuneResult(props: FortuneResultProps) {
  const { method, baziChart, zhouyiChart, ziweiChart, tarotChart, xiaoliurenChart, interpretation, readingId, onBack } = props;
  const meta = METHOD_META[method];
  const [activeTab, setActiveTab] = useState<"chart" | "consult">("chart");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [consultMessages, setConsultMessages] = useState<ConsultMessage[]>([]);
  const [consultInput, setConsultInput] = useState("");
  const [isAskingMaster, setIsAskingMaster] = useState(false);
  const [modelId, setModelId] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("opencat_fortune_last_model");
      if (saved) setModelId(saved);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (readingId && activeTab === "consult") {
      fetch(`/api/fortune/readings/${readingId}/consult`, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : { messages: [] })
        .then((d) => setConsultMessages(d.messages || []))
        .catch(() => {});
    }
  }, [readingId, activeTab]);

  const askMaster = async () => {
    if (!readingId || !consultInput.trim() || !modelId || isAskingMaster) return;
    const msg: ConsultMessage = { id: `local-${Date.now()}`, role: "user", content: consultInput.trim(), createdAt: new Date().toISOString() };
    setConsultInput("");
    setConsultMessages((prev) => [...prev, msg]);
    setIsAskingMaster(true);
    try {
      const res = await fetch(`/api/fortune/readings/${readingId}/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.content, modelId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConsultMessages((prev) => prev.filter((m) => m.id !== msg.id).concat(msg, data.message));
      } else {
        setConsultMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }
    } catch {
      setConsultMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } finally {
      setIsAskingMaster(false);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ animation: "fortune-fade-in-up 0.5s ease-out" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-[var(--fortune-border)] bg-[var(--fortune-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--fortune-text-muted)] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> 返回选择
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${meta.accent}22`, color: meta.accent, border: `1px solid ${meta.accent}33` }}>
              {meta.label}
            </span>
            <button onClick={() => setIsShareOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" style={{ background: `${meta.accent}18`, color: meta.accent, border: `1px solid ${meta.accent}33` }}>
              <Share2 className="h-3.5 w-3.5" /> 分享
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-8">
        {/* Chart display */}
        <div className="mb-8">
          {baziChart && <BaziResultView chart={baziChart} accent={meta.accent} />}
          {ziweiChart && <ZiweiResultView chart={ziweiChart} accent={meta.accent} />}
          {zhouyiChart && <ZhouyiResultView chart={zhouyiChart} accent={meta.accent} />}
          {tarotChart && <TarotResultView chart={tarotChart} accent={meta.accent} />}
          {xiaoliurenChart && <XiaoliurenResultView chart={xiaoliurenChart} accent={meta.accent} />}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-[var(--fortune-border)]">
          {([["chart", "排盘结果"], ["consult", "咨询大师"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                borderColor: activeTab === key ? meta.accent : "transparent",
                color: activeTab === key ? "white" : "var(--fortune-text-muted)",
              }}
            >
              {key === "consult" && <MessageCircle className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "chart" ? (
          <div className="fortune-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <span style={{ color: meta.accent }}>◆</span> AI 解读
            </h3>
            <TypewriterText text={interpretation} accent={meta.accent} />
            <p className="mt-8 rounded-xl border border-[var(--fortune-border)] bg-black/20 p-3 text-[11px] leading-5 text-[var(--fortune-text-muted)]">
              本功能用于传统文化、娱乐和个人反思参考。不应用作医疗、法律、投资、婚恋等重大决策依据。
            </p>
          </div>
        ) : (
          <ConsultPanel
            messages={consultMessages}
            input={consultInput}
            setInput={setConsultInput}
            isAsking={isAskingMaster}
            onSend={askMaster}
            modelId={modelId}
            onModelChange={(id) => { setModelId(id); try { localStorage.setItem("opencat_fortune_last_model", id); } catch {} }}
            accent={meta.accent}
            hasReadingId={!!readingId}
          />
        )}
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        profileName={baziChart?.profileName || ziweiChart?.profileName || xiaoliurenChart?.profileName || ""}
        methodLabel={meta.label}
        interpretation={interpretation}
        dayPillar={baziChart?.pillars.day.stem}
        soul={ziweiChart?.soul}
      />
    </div>
  );
}

/* ---- Consult Panel ---- */
function ConsultPanel({ messages, input, setInput, isAsking, onSend, modelId, onModelChange, accent, hasReadingId }: {
  messages: ConsultMessage[]; input: string; setInput: (v: string) => void;
  isAsking: boolean; onSend: () => void; modelId: string; onModelChange: (v: string) => void;
  accent: string; hasReadingId: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ModelSelector value={modelId} onChange={onModelChange} />
      </div>
      <div className="min-h-[300px] space-y-3 rounded-2xl border border-[var(--fortune-border)] bg-black/20 p-4">
        {messages.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <MessageCircle className="mb-3 h-8 w-8 text-[var(--fortune-text-muted)]" />
            <p className="text-sm text-white">可以开始问大师了</p>
            <p className="mt-1 max-w-sm text-xs text-[var(--fortune-text-muted)]">
              例如：接下来三年事业要注意什么？当前卦象最提醒我的是什么？
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-6 ${msg.role === "user" ? "text-white" : "border border-[var(--fortune-border)] bg-[var(--fortune-surface)] text-[var(--fortune-text)]"}`}
                style={msg.role === "user" ? { background: accent } : {}}>
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isAsking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--fortune-border)] bg-[var(--fortune-surface)] px-4 py-2.5 text-sm text-[var(--fortune-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> 大师正在看盘...
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); } }}
          className="fortune-input min-h-[60px] resize-none"
          style={{ "--active-accent": accent, "--active-glow": `${accent}44` } as React.CSSProperties}
          placeholder={hasReadingId ? "基于当前排盘继续提问..." : "请先生成测算"}
          disabled={!hasReadingId || isAsking}
        />
        <button onClick={onSend} disabled={!hasReadingId || !input.trim() || !modelId || isAsking} className="fortune-btn-primary shrink-0 self-end" style={{ "--active-accent": accent, "--active-accent-hover": accent, "--active-glow": `${accent}44` } as React.CSSProperties}>
          {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ---- Method-specific chart views ---- */

function BaziResultView({ chart, accent }: { chart: BaziChart; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["year", "month", "day", "hour"] as const).map((key) => {
          const p = chart.pillars[key];
          const title = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" }[key];
          return (
            <div key={key} className="fortune-card p-4 text-center" style={{ "--card-accent": accent, "--card-glow": `${accent}44` } as React.CSSProperties}>
              <p className="text-xs text-[var(--fortune-text-muted)]">{title}</p>
              <p className="mt-1 text-2xl font-black text-white">{p.stemBranch}</p>
              <p className="mt-1 text-xs" style={{ color: accent }}>{p.tenGod} · {p.naYin}</p>
            </div>
          );
        })}
      </div>
      {/* Five elements bar */}
      <div className="fortune-card p-4" style={{ "--card-accent": accent } as React.CSSProperties}>
        <h4 className="mb-3 text-sm font-semibold text-white">五行分布</h4>
        <div className="flex gap-2">
          {(["wood", "fire", "earth", "metal", "water"] as const).map((el) => (
            <div key={el} className="flex-1 text-center">
              <div className="mb-1 text-xs text-[var(--fortune-text-muted)]">{elementLabel(el)}</div>
              <div className="h-16 rounded-lg bg-black/30 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-700" style={{ height: `${(chart.fiveElementBalance[el] / chart.fiveElementBalance.total) * 100}%`, background: accent, opacity: 0.7 }} />
              </div>
              <div className="mt-1 text-xs" style={{ color: accent }}>{chart.fiveElementBalance[el]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ZiweiResultView({ chart, accent }: { chart: ZiweiChart; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="fortune-card p-3 text-center" style={{ "--card-accent": accent } as React.CSSProperties}>
          <p className="text-xs text-[var(--fortune-text-muted)]">命宫</p>
          <p className="mt-1 text-lg font-bold text-white">{chart.earthlyBranchOfSoulPalace}</p>
        </div>
        <div className="fortune-card p-3 text-center" style={{ "--card-accent": accent } as React.CSSProperties}>
          <p className="text-xs text-[var(--fortune-text-muted)]">身宫</p>
          <p className="mt-1 text-lg font-bold text-white">{chart.earthlyBranchOfBodyPalace}</p>
        </div>
        <div className="fortune-card p-3 text-center" style={{ "--card-accent": accent } as React.CSSProperties}>
          <p className="text-xs text-[var(--fortune-text-muted)]">五行局</p>
          <p className="mt-1 text-lg font-bold text-white">{chart.fiveElementsClass}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {chart.palaces.map((p) => {
          const stars = p.majorStars.length ? p.majorStars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ""}${s.mutagen ? `化${s.mutagen}` : ""}`).join("、") : "无主星";
          return (
            <div key={`${p.index}-${p.name}`} className="fortune-card p-3" style={{ "--card-accent": accent } as React.CSSProperties}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{p.name}{p.isBodyPalace && <span className="ml-1 text-[10px]" style={{ color: accent }}>身宫</span>}</p>
                <span className="text-[10px] text-[var(--fortune-text-muted)]">{p.heavenlyStem}{p.earthlyBranch}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--fortune-text-muted)]">{stars}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ZhouyiResultView({ chart, accent }: { chart: ZhouyiTimeChart; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="fortune-card p-6" style={{ "--card-accent": accent } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--fortune-text-muted)]">本卦</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-4xl font-black text-white">{chart.primaryHexagram.symbol}</span>
              <span className="text-xl font-bold text-white">{chart.primaryHexagram.name}</span>
            </div>
            <p className="mt-2 text-xs text-[var(--fortune-text-muted)]">第 {chart.primaryHexagram.kingWenNumber} 卦 · 上{chart.upperTrigram.name}下{chart.lowerTrigram.name}</p>
          </div>
          <div className="w-20 space-y-1.5">
            {[...chart.primaryHexagram.lines].reverse().map((isYang, i) => {
              const n = 6 - i;
              return (
                <div key={n} className="flex h-3 items-center gap-1">
                  {isYang ? <span className="h-full w-full rounded-sm" style={{ background: accent }} /> : <><span className="h-full flex-1 rounded-sm bg-white/20" /><span className="h-full flex-1 rounded-sm bg-white/20" /></>}
                  {chart.movingLine === n && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[["互卦", chart.mutualHexagram], ["变卦", chart.changedHexagram]].map(([label, hex]) => (
          <div key={label as string} className="fortune-card p-4" style={{ "--card-accent": accent } as React.CSSProperties}>
            <p className="text-xs text-[var(--fortune-text-muted)]">{label as string}</p>
            <p className="mt-1 text-lg font-bold text-white">{(hex as ZhouyiTimeChart["primaryHexagram"]).symbol} {(hex as ZhouyiTimeChart["primaryHexagram"]).name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TarotResultView({ chart, accent }: { chart: TarotChart; accent: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {chart.cards.map((drawn) => (
        <div key={`${drawn.position.id}-${drawn.card.id}`} className="fortune-card p-5" style={{ "--card-accent": accent, "--card-glow": `${accent}33` } as React.CSSProperties}>
          <p className="text-xs" style={{ color: accent }}>{drawn.position.name}</p>
          <h4 className="mt-2 text-lg font-bold text-white">{drawn.card.name}</h4>
          <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>
            {drawn.orientation === "upright" ? "正位" : "逆位"}
          </span>
          <p className="mt-3 text-xs text-[var(--fortune-text-muted)]">{drawn.position.focus}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {drawn.meaning.slice(0, 4).map((kw) => (
              <span key={kw} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${accent}15`, color: accent }}>{kw}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function XiaoliurenResultView({ chart, accent }: { chart: XiaoliurenChart; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {([["monthResult", "月宫"], ["dayResult", "日宫"], ["hourResult", "时宫（主）"]] as const).map(([key, label]) => {
          const result = chart[key];
          return (
            <div key={key} className="fortune-card p-4 text-center" style={{ "--card-accent": accent, "--card-glow": `${accent}44` } as React.CSSProperties}>
              <p className="text-xs text-[var(--fortune-text-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{result.name}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>{result.fortune}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {result.keywords.map((kw) => (
                  <span key={kw} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: `${accent}18`, color: accent }}>{kw}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Final result emphasis */}
      <div className="fortune-card p-5" style={{ "--card-accent": accent } as React.CSSProperties}>
        <h4 className="mb-2 text-sm font-semibold text-white">最终结果：{chart.hourResult.name}</h4>
        <p className="text-sm leading-6 text-[var(--fortune-text-muted)]">{chart.hourResult.meaning}</p>
        <p className="mt-3 text-sm font-medium" style={{ color: accent }}>{chart.hourResult.advice}</p>
      </div>
      <div className="fortune-card p-3 text-xs text-[var(--fortune-text-muted)]" style={{ "--card-accent": accent } as React.CSSProperties}>
        <span className="font-medium text-white">计算口径：</span>
        {chart.calculationBasis.lunarDate} · {chart.calculationBasis.hourBranch}时
      </div>
    </div>
  );
}
