import type { FortuneMethod } from "./types";

export function getFortuneMethodName(method: FortuneMethod) {
  const names: Record<FortuneMethod, string> = {
    bazi: "四柱八字",
    ziwei: "紫微斗数",
    zhouyi: "周易时间卦",
    tarot: "塔罗牌阵",
  };
  return names[method];
}

export function getStoredFortuneMethod(rawChart: unknown): FortuneMethod {
  if (rawChart && typeof rawChart === "object" && "method" in rawChart) {
    const method = (rawChart as { method?: unknown }).method;
    if (method === "bazi" || method === "ziwei" || method === "zhouyi" || method === "tarot") {
      return method;
    }
  }
  if (rawChart && typeof rawChart === "object" && "chart" in rawChart) {
    return getStoredFortuneMethod((rawChart as { chart?: unknown }).chart);
  }
  if (rawChart && typeof rawChart === "object" && "bazi" in rawChart) return "bazi";
  if (rawChart && typeof rawChart === "object" && "palaces" in rawChart) return "ziwei";
  if (rawChart && typeof rawChart === "object" && "primaryHexagram" in rawChart) return "zhouyi";
  if (rawChart && typeof rawChart === "object" && "cards" in rawChart) return "tarot";
  return "bazi";
}

export function storeFortuneChart(method: FortuneMethod, chart: unknown) {
  return {
    method,
    chart,
  } as object;
}
