"use client";

import { useState } from "react";
import type { FortuneMethod } from "@/lib/fortune/types";

interface MethodCard {
  value: FortuneMethod;
  label: string;
  kicker: string;
  description: string;
  icon: string;
  accent: string;
  glow: string;
  bg: string;
  glyphs: string[];
}

const METHODS: MethodCard[] = [
  {
    value: "bazi",
    label: "四柱八字",
    kicker: "干支五行",
    description: "以出生年月日时排四柱，观察十神、旺衰、格局与流年。",
    icon: "甲",
    accent: "var(--fortune-bazi)",
    glow: "var(--fortune-bazi-glow)",
    bg: "var(--fortune-bazi-bg)",
    glyphs: ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸", "子", "丑"],
  },
  {
    value: "ziwei",
    label: "紫微斗数",
    kicker: "星曜十二宫",
    description: "安命宫身宫，排十四主星与四化，读人生结构的重心。",
    icon: "紫",
    accent: "var(--fortune-ziwei)",
    glow: "var(--fortune-ziwei-glow)",
    bg: "var(--fortune-ziwei-bg)",
    glyphs: ["命", "兄", "夫", "子", "财", "疾", "迁", "奴", "官", "田", "福", "父"],
  },
  {
    value: "zhouyi",
    label: "周易时间卦",
    kicker: "本卦互卦变卦",
    description: "按测算时刻起卦，取动爻与变卦，看当下问题的势能。",
    icon: "卦",
    accent: "var(--fortune-zhouyi)",
    glow: "var(--fortune-zhouyi-glow)",
    bg: "var(--fortune-zhouyi-bg)",
    glyphs: ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"],
  },
  {
    value: "tarot",
    label: "塔罗牌阵",
    kicker: "三牌镜像",
    description: "抽取过去、现在、未来三张牌，把问题拆成可感知的象征。",
    icon: "T",
    accent: "var(--fortune-tarot)",
    glow: "var(--fortune-tarot-glow)",
    bg: "var(--fortune-tarot-bg)",
    glyphs: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
  },
  {
    value: "xiaoliuren",
    label: "小六壬",
    kicker: "六神速断",
    description: "按农历月、日、时轮转六宫，适合问即时吉凶与行动节奏。",
    icon: "六",
    accent: "var(--fortune-xiaoliuren)",
    glow: "var(--fortune-xiaoliuren-glow)",
    bg: "var(--fortune-xiaoliuren-bg)",
    glyphs: ["大安", "留连", "速喜", "赤口", "小吉", "空亡"],
  },
];

const BAGUA = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];
const HEX_LINES = [true, false, true, true, false, false];

interface FortuneHeroProps {
  onSelectMethod: (method: FortuneMethod) => void;
}

export function FortuneHero({ onSelectMethod }: FortuneHeroProps) {
  const [activeMethod, setActiveMethod] = useState<FortuneMethod>("bazi");
  const active = METHODS.find((method) => method.value === activeMethod) || METHODS[0];

  return (
    <main
      className="fortune-hero-shell"
      style={
        {
          "--active-accent": active.accent,
          "--active-glow": active.glow,
          "--active-bg": active.bg,
        } as React.CSSProperties
      }
    >
      <div className="fortune-hero-grid">
        <section className="fortune-hero-copy">
          <div className="fortune-hero-eyebrow">
            <span className="fortune-status-dot" />
            OpenCat · 玄枢
          </div>

          <h1 className="fortune-hero-title">
            玄枢
            <span>问卦、观盘、抽牌</span>
          </h1>

          <p className="fortune-hero-lede">
            四柱、周易、紫微、小六壬与塔罗并置。先定盘，再解象，把一刻的时间、一个问题，拆成可读的线索。
          </p>

          <div className="fortune-hero-actions">
            <button
              type="button"
              className="fortune-command-button"
              onClick={() => onSelectMethod(active.value)}
            >
              <span>{active.icon}</span>
              开始{active.label}
            </button>
            <div className="fortune-method-note">
              当前校准：<strong>{active.kicker}</strong>
            </div>
          </div>

          <div className="fortune-method-rail" aria-label="选择测算方式">
            {METHODS.map((method) => {
              const isActive = method.value === active.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onMouseEnter={() => setActiveMethod(method.value)}
                  onFocus={() => setActiveMethod(method.value)}
                  onClick={() => onSelectMethod(method.value)}
                  className={`fortune-method-row ${isActive ? "is-active" : ""}`}
                  style={
                    {
                      "--row-accent": method.accent,
                      "--row-bg": method.bg,
                    } as React.CSSProperties
                  }
                >
                  <span className="fortune-method-mark">{method.icon}</span>
                  <span>
                    <span className="fortune-method-label">{method.label}</span>
                    <span className="fortune-method-desc">{method.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="fortune-oracle-zone" aria-label={`${active.label}动态预览`}>
          <div className="fortune-oracle-frame">
            <div className="fortune-oracle-scanline" />
            <MethodOracle method={active} />
          </div>
          <div className="fortune-oracle-caption">
            <span>{active.label}</span>
            <span>{active.glyphs.slice(0, 4).join(" / ")}</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function MethodOracle({ method }: { method: MethodCard }) {
  if (method.value === "tarot") {
    return (
      <div className="fortune-tarot-oracle">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="fortune-tarot-card"
            style={
              {
                transform: `translateX(${(index - 1) * 72}px) rotate(${(index - 1) * 8}deg)`,
                animationDelay: `${index * 0.18}s`,
              } as React.CSSProperties
            }
          >
            <span>{index === 1 ? "ORACLE" : method.glyphs[index]}</span>
          </div>
        ))}
      </div>
    );
  }

  if (method.value === "xiaoliuren") {
    return (
      <div className="fortune-six-oracle">
        {method.glyphs.map((god, index) => (
          <span key={god} style={{ "--six-delay": `${index * 0.18}s` } as React.CSSProperties}>
            {god}
          </span>
        ))}
        <div className="fortune-six-pointer" />
      </div>
    );
  }

  if (method.value === "zhouyi") {
    return (
      <div className="fortune-hex-oracle">
        <div className="fortune-bagua-ring">
          {BAGUA.map((name, index) => (
            <span
              key={name}
              style={
                {
                  "--bagua-angle": `${index * 45}deg`,
                  "--bagua-counter-angle": `${index * -45}deg`,
                } as React.CSSProperties
              }
            >
              {name}
            </span>
          ))}
        </div>
        <div className="fortune-hex-lines">
          {[...HEX_LINES].reverse().map((isYang, index) => (
            <span key={index} className={isYang ? "is-yang" : "is-yin"} />
          ))}
        </div>
      </div>
    );
  }

  if (method.value === "ziwei") {
    return (
      <div className="fortune-ziwei-oracle">
        {method.glyphs.map((palace, index) => (
          <span key={palace} style={{ "--palace-delay": `${index * 0.04}s` } as React.CSSProperties}>
            {palace}
          </span>
        ))}
        <div className="fortune-star-core">紫微</div>
      </div>
    );
  }

  return (
    <div className="fortune-bazi-oracle">
      <div className="fortune-bagua-ring">
        {BAGUA.map((name, index) => (
          <span
            key={name}
            style={
              {
                "--bagua-angle": `${index * 45}deg`,
                "--bagua-counter-angle": `${index * -45}deg`,
              } as React.CSSProperties
            }
          >
            {name}
          </span>
        ))}
      </div>
      <div className="fortune-stem-ring">
        {method.glyphs.map((glyph, index) => (
          <span
            key={`${glyph}-${index}`}
            style={
              {
                "--stem-angle": `${index * 30}deg`,
                "--stem-counter-angle": `${index * -30}deg`,
              } as React.CSSProperties
            }
          >
            {glyph}
          </span>
        ))}
      </div>
      <div className="fortune-yinyang-core">
        <span />
      </div>
    </div>
  );
}
