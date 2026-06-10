import type { BaziChart, FortuneCompositeChart } from "./types";
import type { ZhouyiTimeChart } from "./zhouyi";
import type { TarotChart } from "./tarot";
import type { ZiweiChart } from "./ziwei";

export interface ExtractedFortuneCharts {
  bazi: BaziChart | null;
  zhouyi?: ZhouyiTimeChart;
  ziwei?: ZiweiChart;
  tarot?: TarotChart;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBaziChart(value: unknown): value is BaziChart {
  return isRecord(value) && isRecord(value.pillars) && isRecord(value.pillars.day);
}

function isZhouyiTimeChart(value: unknown): value is ZhouyiTimeChart {
  return isRecord(value) && value.method === "meihua-time" && isRecord(value.primaryHexagram);
}

function isTarotChart(value: unknown): value is TarotChart {
  return isRecord(value) && value.method === "tarot-deterministic-draw" && Array.isArray(value.cards);
}

function isZiweiChart(value: unknown): value is ZiweiChart {
  return isRecord(value) && value.method === "ziwei-astrolabe" && Array.isArray(value.palaces);
}

export function extractFortuneCharts(rawChart: unknown): ExtractedFortuneCharts {
  if (!isRecord(rawChart)) {
    return { bazi: null };
  }

  const composite = rawChart as Partial<FortuneCompositeChart>;
  if (isBaziChart(composite.bazi)) {
    return {
      bazi: composite.bazi,
      zhouyi: isZhouyiTimeChart(composite.zhouyi) ? composite.zhouyi : undefined,
      ziwei: isZiweiChart(composite.ziwei) ? composite.ziwei : undefined,
      tarot: isTarotChart(composite.tarot) ? composite.tarot : undefined,
    };
  }

  if (isBaziChart(rawChart)) {
    return { bazi: rawChart };
  }

  return { bazi: null };
}

export function getFortuneDayPillar(rawChart: unknown) {
  return extractFortuneCharts(rawChart).bazi?.pillars.day.stemBranch || "";
}
