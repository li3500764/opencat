"use client";

import type { FortuneMethod } from "@/lib/fortune/types";

interface MethodCard {
  value: FortuneMethod;
  label: string;
  description: string;
  icon: string;
  accent: string;
  glow: string;
}

const METHODS: MethodCard[] = [
  {
    value: "bazi",
    label: "四柱八字",
    description: "天干地支 · 五行十神 · 格局旺衰",
    icon: "☰",
    accent: "var(--fortune-bazi)",
    glow: "var(--fortune-bazi-glow)",
  },
  {
    value: "ziwei",
    label: "紫微斗数",
    description: "十二宫位 · 星曜四化 · 命身格局",
    icon: "✦",
    accent: "var(--fortune-ziwei)",
    glow: "var(--fortune-ziwei-glow)",
  },
  {
    value: "zhouyi",
    label: "周易时间卦",
    description: "本卦动爻 · 互卦变卦 · 梅花易数",
    icon: "☷",
    accent: "var(--fortune-zhouyi)",
    glow: "var(--fortune-zhouyi-glow)",
  },
  {
    value: "tarot",
    label: "塔罗牌阵",
    description: "三张牌阵 · 正逆位解读 · 过去现在未来",
    icon: "🂠",
    accent: "var(--fortune-tarot)",
    glow: "var(--fortune-tarot-glow)",
  },
  {
    value: "xiaoliuren",
    label: "小六壬",
    description: "大安留连 · 速喜赤口 · 小吉空亡",
    icon: "☯",
    accent: "var(--fortune-xiaoliuren)",
    glow: "var(--fortune-xiaoliuren-glow)",
  },
];

interface FortuneHeroProps {
  onSelectMethod: (method: FortuneMethod) => void;
}

export function FortuneHero({ onSelectMethod }: FortuneHeroProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-20">
      {/* Decorative bagua ring */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <div
          className="h-[600px] w-[600px] rounded-full border border-white/20"
          style={{ animation: "fortune-rotate 60s linear infinite" }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 h-[300px] w-px origin-bottom -translate-x-1/2 -translate-y-full bg-white/30"
              style={{ transform: `translate(-50%, -100%) rotate(${i * 45}deg)` }}
            />
          ))}
        </div>
        <div
          className="absolute h-[400px] w-[400px] rounded-full border border-white/10"
          style={{ animation: "fortune-rotate-reverse 45s linear infinite" }}
        />
      </div>

      {/* Title */}
      <div
        className="relative z-10 mb-16 text-center"
        style={{ animation: "fortune-fade-in-up 0.8s ease-out" }}
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--fortune-text-muted)]">
          OpenCat · AI 命理引擎
        </p>
        <h1 className="mb-4 text-5xl font-black tracking-tight text-white sm:text-6xl">
          天命可知
        </h1>
        <p className="mx-auto max-w-lg text-base leading-7 text-[var(--fortune-text-muted)]">
          五种传统术数，程序精确排盘，AI 深度解读。
          <br />
          选择一种测算方法，窥探命运的纹理。
        </p>
      </div>

      {/* Method cards */}
      <div
        className="relative z-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ animation: "fortune-fade-in-up 1s ease-out 0.2s both" }}
      >
        {METHODS.map((method, index) => (
          <button
            key={method.value}
            onClick={() => onSelectMethod(method.value)}
            className="fortune-card group relative overflow-hidden p-6 text-left"
            style={
              {
                "--card-accent": method.accent,
                "--card-glow": method.glow,
                animationDelay: `${0.1 * index}s`,
              } as React.CSSProperties
            }
          >
            {/* Glow orb behind icon */}
            <div
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
              style={{ background: method.accent }}
            />

            {/* Icon */}
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{
                background: `linear-gradient(135deg, ${method.accent}22, ${method.accent}08)`,
                border: `1px solid ${method.accent}33`,
                color: method.accent,
              }}
            >
              <span style={{ animation: "fortune-float 4s ease-in-out infinite", animationDelay: `${index * 0.5}s` }}>
                {method.icon}
              </span>
            </div>

            {/* Text */}
            <h3 className="mb-1 text-lg font-bold text-white">{method.label}</h3>
            <p className="text-sm leading-5 text-[var(--fortune-text-muted)]">
              {method.description}
            </p>

            {/* Arrow hint */}
            <div
              className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: method.accent }}
            >
              开始测算
              <span className="text-base">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* History hint */}
      <p
        className="relative z-10 mt-12 text-center text-xs text-[var(--fortune-text-muted)]"
        style={{ animation: "fortune-fade-in-up 1s ease-out 0.6s both" }}
      >
        所有测算结果仅对当前账户可见 · 程序排盘 + AI 解读
      </p>
    </div>
  );
}
