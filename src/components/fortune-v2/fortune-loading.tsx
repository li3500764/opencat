"use client";

import { useEffect, useState } from "react";
import type { FortuneMethod } from "@/lib/fortune/types";

const THEMES: Record<FortuneMethod, { accent: string; glow: string; label: string; phases: string[] }> = {
  bazi: {
    accent: "var(--fortune-bazi)",
    glow: "var(--fortune-bazi-glow)",
    label: "四柱八字",
    phases: ["推算天干地支...", "排列五行生克...", "演算十神格局...", "AI 深度解读中..."],
  },
  ziwei: {
    accent: "var(--fortune-ziwei)",
    glow: "var(--fortune-ziwei-glow)",
    label: "紫微斗数",
    phases: ["安放命宫身宫...", "布置十二宫位...", "星曜归位中...", "AI 深度解读中..."],
  },
  zhouyi: {
    accent: "var(--fortune-zhouyi)",
    glow: "var(--fortune-zhouyi-glow)",
    label: "周易时间卦",
    phases: ["起卦中...", "排列六爻...", "推演变卦...", "AI 深度解读中..."],
  },
  tarot: {
    accent: "var(--fortune-tarot)",
    glow: "var(--fortune-tarot-glow)",
    label: "塔罗牌阵",
    phases: ["洗牌中...", "抽取牌阵...", "解读牌义...", "AI 深度解读中..."],
  },
  xiaoliuren: {
    accent: "var(--fortune-xiaoliuren)",
    glow: "var(--fortune-xiaoliuren-glow)",
    label: "小六壬",
    phases: ["推算农历月日时...", "掐指轮转中...", "六神定位...", "AI 深度解读中..."],
  },
};

interface FortuneLoadingProps {
  method: FortuneMethod;
}

const SIX_GODS = ["大安", "留连", "速喜", "赤口", "小吉", "空亡"];
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const HEXAGRAM_LINES = [true, false, true, true, false, true]; // example hexagram

function BaziAnimation({ accent }: { accent: string }) {
  return (
    <div className="relative h-48 w-48">
      {/* Outer ring - Heavenly Stems */}
      <div className="absolute inset-0 rounded-full border border-white/10" style={{ animation: "fortune-rotate 12s linear infinite" }}>
        {STEMS.map((stem, i) => (
          <span
            key={stem}
            className="absolute left-1/2 top-1/2 text-sm font-bold"
            style={{
              color: i % 2 === 0 ? accent : "var(--fortune-text-muted)",
              transform: `translate(-50%, -50%) rotate(${i * 36}deg) translateY(-88px) rotate(-${i * 36}deg)`,
            }}
          >
            {stem}
          </span>
        ))}
      </div>
      {/* Inner ring - Earthly Branches */}
      <div className="absolute inset-6 rounded-full border border-white/5" style={{ animation: "fortune-rotate-reverse 8s linear infinite" }}>
        {BRANCHES.map((branch, i) => (
          <span
            key={branch}
            className="absolute left-1/2 top-1/2 text-xs"
            style={{
              color: "var(--fortune-text-muted)",
              transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-56px) rotate(-${i * 30}deg)`,
            }}
          >
            {branch}
          </span>
        ))}
      </div>
      {/* Center glow */}
      <div className="absolute inset-16 rounded-full" style={{ background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`, animation: "fortune-glow 2s ease-in-out infinite", ["--glow-color" as string]: accent }} />
    </div>
  );
}

function ZiweiAnimation({ accent }: { accent: string }) {
  return (
    <div className="relative h-48 w-48">
      <div className="absolute inset-0 rounded-full border border-white/10" style={{ animation: "fortune-rotate 20s linear infinite" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-80px)`,
            }}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{
                background: i < 4 ? accent : "var(--fortune-text-muted)",
                boxShadow: i < 4 ? `0 0 12px ${accent}` : "none",
                animation: `fortune-glow 1.5s ease-in-out ${i * 0.2}s infinite`,
                ["--glow-color" as string]: accent,
              }}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-12 rounded-full border border-dashed border-white/5" style={{ animation: "fortune-rotate-reverse 15s linear infinite" }} />
      <div className="absolute inset-20 rounded-full" style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, animation: "fortune-glow 3s ease-in-out infinite", ["--glow-color" as string]: accent }} />
    </div>
  );
}

function ZhouyiAnimation({ accent }: { accent: string }) {
  const [visibleLines, setVisibleLines] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setVisibleLines((v) => (v >= 6 ? 0 : v + 1)), 600);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="relative flex h-48 w-48 flex-col items-center justify-center gap-2">
      {[...HEXAGRAM_LINES].reverse().map((isYang, i) => {
        const lineIndex = 6 - i;
        const isVisible = lineIndex <= visibleLines;
        return (
          <div
            key={i}
            className="flex h-3 w-28 items-center gap-2 transition-all duration-300"
            style={{ opacity: isVisible ? 1 : 0.1 }}
          >
            {isYang ? (
              <div className="h-full w-full rounded-sm" style={{ background: isVisible ? accent : "var(--fortune-text-muted)" }} />
            ) : (
              <>
                <div className="h-full flex-1 rounded-sm" style={{ background: isVisible ? accent : "var(--fortune-text-muted)" }} />
                <div className="h-full flex-1 rounded-sm" style={{ background: isVisible ? accent : "var(--fortune-text-muted)" }} />
              </>
            )}
          </div>
        );
      })}
      {/* Trigram symbols */}
      <div className="mt-4 flex gap-4 text-lg" style={{ color: accent }}>
        <span style={{ animation: "fortune-float 3s ease-in-out infinite" }}>☰</span>
        <span style={{ animation: "fortune-float 3s ease-in-out 0.5s infinite" }}>☷</span>
        <span style={{ animation: "fortune-float 3s ease-in-out 1s infinite" }}>☳</span>
      </div>
    </div>
  );
}

function TarotAnimation({ accent }: { accent: string }) {
  return (
    <div className="relative flex h-48 w-64 items-center justify-center">
      {[-1, 0, 1].map((offset) => (
        <div
          key={offset}
          className="absolute h-32 w-20 rounded-lg border"
          style={{
            background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
            borderColor: `${accent}44`,
            transform: `translateX(${offset * 40}px) rotate(${offset * 8}deg)`,
            animation: `fortune-float 3s ease-in-out ${offset === 0 ? "0s" : offset === -1 ? "0.5s" : "1s"} infinite`,
            boxShadow: `0 8px 32px -8px ${accent}33`,
          }}
        >
          {/* Card back pattern */}
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="h-16 w-12 rounded-md border border-dashed"
              style={{ borderColor: `${accent}33` }}
            >
              <div className="flex h-full items-center justify-center text-xl" style={{ color: `${accent}66` }}>
                ✦
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function XiaoliurenAnimation({ accent }: { accent: string }) {
  const [activeGod, setActiveGod] = useState(0);
  const [speed, setSpeed] = useState(200);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setActiveGod((prev) => (prev + 1) % 6);
      setSpeed((prev) => Math.min(prev + 20, 600));
      timeout = setTimeout(cycle, speed);
    };
    timeout = setTimeout(cycle, speed);
    return () => clearTimeout(timeout);
  }, [speed]);

  return (
    <div className="relative flex h-48 w-64 items-center justify-center">
      {/* Palm diagram */}
      <div className="grid grid-cols-3 grid-rows-2 gap-2">
        {SIX_GODS.map((god, i) => {
          const isActive = activeGod === i;
          // Arrange in palm positions: top-left, top-mid, top-right, bottom-right, bottom-mid, bottom-left
          const positions = [0, 1, 2, 5, 4, 3];
          return (
            <div
              key={god}
              className="flex h-14 w-14 items-center justify-center rounded-xl border text-sm font-bold transition-all duration-200"
              style={{
                background: isActive ? `${accent}22` : "transparent",
                borderColor: isActive ? accent : "var(--fortune-border)",
                color: isActive ? accent : "var(--fortune-text-muted)",
                boxShadow: isActive ? `0 0 20px -4px ${accent}` : "none",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                order: positions[i],
              }}
            >
              {god}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FortuneLoading({ method }: FortuneLoadingProps) {
  const theme = THEMES[method];
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % theme.phases.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [theme.phases.length]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Animation area */}
      <div className="mb-12" style={{ animation: "fortune-fade-in-up 0.6s ease-out" }}>
        {method === "bazi" && <BaziAnimation accent={theme.accent} />}
        {method === "ziwei" && <ZiweiAnimation accent={theme.accent} />}
        {method === "zhouyi" && <ZhouyiAnimation accent={theme.accent} />}
        {method === "tarot" && <TarotAnimation accent={theme.accent} />}
        {method === "xiaoliuren" && <XiaoliurenAnimation accent={theme.accent} />}
      </div>

      {/* Method label */}
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: theme.accent }}
      >
        {theme.label}
      </p>

      {/* Phase text */}
      <p className="fortune-shimmer-text text-xl font-bold">
        {theme.phases[phaseIndex]}
      </p>

      {/* Ripple decoration */}
      <div className="relative mt-12 h-8 w-8">
        <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${theme.accent}`, animation: "fortune-ripple 2s ease-out infinite" }} />
        <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${theme.accent}`, animation: "fortune-ripple 2s ease-out 0.7s infinite" }} />
        <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${theme.accent}`, animation: "fortune-ripple 2s ease-out 1.4s infinite" }} />
      </div>
    </div>
  );
}
