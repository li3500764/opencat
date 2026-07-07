import type { BaziChart, FortuneCompositeChart } from "./types";
import type { ZhouyiTimeChart } from "./zhouyi";
import type { TarotChart } from "./tarot";
import type { ZiweiChart } from "./ziwei";
import type { XiaoliurenChart } from "./xiaoliuren";

export interface ExtractedFortuneCharts {
  bazi: BaziChart | null;
  zhouyi?: ZhouyiTimeChart;
  ziwei?: ZiweiChart;
  tarot?: TarotChart;
  xiaoliuren?: XiaoliurenChart;
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

function isXiaoliurenChart(value: unknown): value is XiaoliurenChart {
  return isRecord(value) && value.method === "xiaoliuren" && isRecord(value.monthResult) && isRecord(value.hourResult);
}

export function extractFortuneCharts(rawChart: unknown): ExtractedFortuneCharts {
  if (!isRecord(rawChart)) {
    return { bazi: null };
  }

  if (isRecord(rawChart.chart)) {
    return extractFortuneCharts(rawChart.chart);
  }

  const composite = rawChart as Partial<FortuneCompositeChart>;
  if (isBaziChart(composite.bazi)) {
    return {
      bazi: composite.bazi,
      zhouyi: isZhouyiTimeChart(composite.zhouyi) ? composite.zhouyi : undefined,
      ziwei: isZiweiChart(composite.ziwei) ? composite.ziwei : undefined,
      tarot: isTarotChart(composite.tarot) ? composite.tarot : undefined,
      xiaoliuren: isXiaoliurenChart(composite.xiaoliuren) ? composite.xiaoliuren : undefined,
    };
  }

  if (isBaziChart(rawChart)) {
    return { bazi: rawChart };
  }

  if (isZhouyiTimeChart(rawChart)) {
    return { bazi: null, zhouyi: rawChart };
  }

  if (isZiweiChart(rawChart)) {
    return { bazi: null, ziwei: rawChart };
  }

  if (isTarotChart(rawChart)) {
    return { bazi: null, tarot: rawChart };
  }

  if (isXiaoliurenChart(rawChart)) {
    return { bazi: null, xiaoliuren: rawChart };
  }

  return { bazi: null };
}

export function getFortuneDayPillar(rawChart: unknown) {
  return extractFortuneCharts(rawChart).bazi?.pillars.day.stemBranch || "";
}

export function getFortuneChartSummary(rawChart: unknown) {
  const charts = extractFortuneCharts(rawChart);
  if (charts.bazi) return charts.bazi.pillars.day.stemBranch;
  if (charts.ziwei) return `命宫${charts.ziwei.earthlyBranchOfSoulPalace}`;
  if (charts.zhouyi) return charts.zhouyi.primaryHexagram.name;
  if (charts.tarot) return charts.tarot.cards.map((card) => card.card.name).join(" / ");
  if (charts.xiaoliuren) return charts.xiaoliuren.hourResult.name;
  return "";
}
