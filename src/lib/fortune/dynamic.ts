import { astro } from "iztro";
import { Solar } from "lunar-typescript";
import { buildBaziDynamicContextForYear } from "./chart";
import { parsePlainLocalDateTime } from "./time";
import { buildZiweiDynamicContext, type ZiweiChart } from "./ziwei";
import type {
  BaziChart,
  DynamicTargetRange,
  FortuneDynamicContext,
  FortuneMethod,
  ZiweiDynamicContext,
} from "./types";

export type DynamicTargetParseResult =
  | { status: "none" }
  | { status: "clarification"; message: string }
  | {
      status: "resolved";
      range: DynamicTargetRange;
      requestedMonths: string[];
    };

export type DynamicConsultContextResult =
  | { status: "none" }
  | { status: "clarification"; message: string }
  | {
      status: "resolved";
      targetRange: DynamicTargetRange;
      requestedMonths: string[];
      dynamicContexts: FortuneDynamicContext[];
    };

const CHINESE_NUMBERS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12,
};

export function parseDynamicTargetRange(
  question: string,
  anchorLocalDateTime: string,
  timezone: string
): DynamicTargetParseResult {
  const anchor = parsePlainLocalDateTime(anchorLocalDateTime);
  const vague = /哪几个月|哪一年|几年后|几月|什么时候|何时/.test(question);
  if (vague) {
    return { status: "clarification", message: "请明确要查看的年份或年月范围，例如“2026 年 7 至 12 月”。" };
  }

  const futureMatch = question.match(/未来\s*([一二三四五六七八九十\d]+)\s*年/);
  if (futureMatch) {
    const count = parseChineseOrArabicNumber(futureMatch[1]);
    if (!count || count > 10) return rangeLimitMessage();
    return resolvedMonths(
      Array.from({ length: count * 12 }, (_, index) => monthKey(anchor.year, index + 1)),
      timezone,
      question,
      "year"
    );
  }

  const yearRangeMatch = question.match(/((?:19|20)\d{2})\s*(?:至|到|-|—|~|～)\s*((?:19|20)\d{2})\s*年/);
  if (yearRangeMatch) {
    const startYear = Number(yearRangeMatch[1]);
    const endYear = Number(yearRangeMatch[2]);
    if (endYear < startYear || endYear - startYear + 1 > 10) return rangeLimitMessage();
    const months: string[] = [];
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) months.push(formatMonth(year, month));
    }
    return resolvedMonths(months, timezone, question, "year");
  }

  const explicitYear = Number(question.match(/((?:19|20)\d{2})\s*年/)?.[1] || 0);
  let targetYear = explicitYear || anchor.year;
  if (/明年/.test(question)) targetYear = anchor.year + 1;
  else if (/后年/.test(question)) targetYear = anchor.year + 2;
  else if (/今年/.test(question)) targetYear = anchor.year;

  let months: number[] = [];
  const monthRange = question.match(/(1[0-2]|0?[1-9])\s*(?:至|到|-|—|~|～)\s*(1[0-2]|0?[1-9])\s*月/);
  if (monthRange) {
    const start = Number(monthRange[1]);
    const end = Number(monthRange[2]);
    if (end < start) {
      return { status: "clarification", message: "月份范围顺序有误，请按起始月至结束月重新输入。" };
    }
    months = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  } else {
    const monthList = question.match(/((?:1[0-2]|0?[1-9])(?:\s*[、,，]\s*(?:1[0-2]|0?[1-9]))+)\s*月/);
    if (monthList) {
      months = monthList[1].split(/[、,，]/).map(Number);
    } else if (/上半年/.test(question)) {
      months = [1, 2, 3, 4, 5, 6];
    } else if (/下半年/.test(question)) {
      months = [7, 8, 9, 10, 11, 12];
    } else {
      const quarter = Number(question.match(/第?([1-4])\s*季度/)?.[1] || 0);
      if (quarter) months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
      else {
        const singleMonth = Number(question.match(/(1[0-2]|0?[1-9])\s*月/)?.[1] || 0);
        if (singleMonth) months = [singleMonth];
      }
    }
  }

  const hasYearIntent = Boolean(explicitYear || /明年|后年|今年/.test(question));
  if (months.length === 0 && hasYearIntent) months = Array.from({ length: 12 }, (_, index) => index + 1);
  if (months.length === 0) return { status: "none" };

  return resolvedMonths(
    [...new Set(months)].sort((left, right) => left - right).map((month) => formatMonth(targetYear, month)),
    timezone,
    question,
    hasYearIntent && months.length === 12 ? "year" : "month"
  );
}

export function buildDynamicConsultContext(input: {
  method: FortuneMethod;
  chart: unknown;
  question: string;
}): DynamicConsultContextResult {
  const chart = unwrapChart(input.chart);
  if (!isRecord(chart) || !isRecord(chart.calculationBasis)) return { status: "none" };
  const basis = chart.calculationBasis;
  const anchor = typeof basis.queryDateTimeLocal === "string" ? basis.queryDateTimeLocal : "";
  const timezone = typeof basis.timezone === "string" ? basis.timezone : "Asia/Shanghai";
  if (!anchor) return { status: "none" };
  const parsed = parseDynamicTargetRange(input.question, anchor, timezone);
  if (parsed.status !== "resolved") return parsed;

  if (input.method === "bazi") {
    if (basis.ruleSet !== "opencat-ziping-v2") return legacyMessage();
    const bazi = chart as unknown as BaziChart;
    const groupedYears = [...new Set(parsed.requestedMonths.map((month) => Number(month.slice(0, 4))))];
    const dynamicContexts = groupedYears.map((year) => {
      const context = buildBaziDynamicContextForYear({
        year,
        timezone,
        dayStem: bazi.pillars.day.stem,
        natalPillars: bazi.pillars,
        luckCycles: bazi.luckCycles,
        queryDateTimeLocal: anchor,
      });
      const requested = new Set(parsed.requestedMonths);
      return {
        ...context,
        targetRange: parsed.range,
        monthSegments: context.monthSegments.filter((segment) => requested.has(segment.gregorianMonth)),
      };
    });
    return {
      status: "resolved",
      targetRange: parsed.range,
      requestedMonths: parsed.requestedMonths,
      dynamicContexts,
    };
  }

  if (input.method === "ziwei") {
    if (basis.ruleSet !== "opencat-ziwei-v2") return legacyMessage();
    const ziwei = chart as unknown as ZiweiChart;
    const gender = ziwei.gender === "female" ? "女" : "男";
    const astrolabe = astro.bySolar(ziwei.solarDate, ziwei.timeIndex, gender, true, "zh-CN");
    const dynamicContexts = buildZiweiContextsForMonths(astrolabe, parsed.requestedMonths, timezone);
    return {
      status: "resolved",
      targetRange: parsed.range,
      requestedMonths: parsed.requestedMonths,
      dynamicContexts,
    };
  }

  return { status: "none" };
}

function buildZiweiContextsForMonths(
  astrolabe: ReturnType<typeof astro.bySolar>,
  requestedMonths: string[],
  timezone: string
) {
  const contexts: ZiweiDynamicContext[] = [];
  for (const key of requestedMonths) {
    const [year, month] = key.split("-").map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthEnd = month === 12
      ? `${year + 1}-01-01T00:00`
      : `${year}-${pad(month + 1)}-01T00:00`;
    const candidateDays = [
      1,
      ...Array.from({ length: days - 1 }, (_, index) => index + 2).filter(
        (day) => Solar.fromYmd(year, month, day).getLunar().getDay() === 1
      ),
    ];
    let active: { context: ZiweiDynamicContext; startLocalDateTime: string } | null = null;
    for (const day of candidateDays) {
      const local = `${year}-${pad(month)}-${pad(day)}T12:00`;
      const context = buildZiweiDynamicContext(astrolabe, local, timezone);
      const boundary = `${year}-${pad(month)}-${pad(day)}T00:00`;
      if (active) contexts.push(withZiweiSegmentRange(active.context, active.startLocalDateTime, boundary, key));
      active = { context, startLocalDateTime: boundary };
    }
    if (active) contexts.push(withZiweiSegmentRange(active.context, active.startLocalDateTime, monthEnd, key));
  }
  return contexts;
}

function withZiweiSegmentRange(
  context: ZiweiDynamicContext,
  startLocalDateTime: string,
  endLocalDateTime: string,
  gregorianMonth: string
): ZiweiDynamicContext {
  return {
    ...context,
    targetRange: {
      ...context.targetRange,
      startLocalDateTime,
      endLocalDateTime,
      granularity: "month",
      sourceText: `公历 ${gregorianMonth}`,
    },
  };
}

function resolvedMonths(
  requestedMonths: string[],
  timezone: string,
  sourceText: string,
  granularity: "year" | "month"
): DynamicTargetParseResult {
  const unique = [...new Set(requestedMonths)].sort();
  if (unique.length === 0 || unique.length > 120) return rangeLimitMessage();
  const [startYear, startMonth] = unique[0].split("-").map(Number);
  const [lastYear, lastMonth] = unique[unique.length - 1].split("-").map(Number);
  const next = lastMonth === 12 ? [lastYear + 1, 1] : [lastYear, lastMonth + 1];
  return {
    status: "resolved",
    requestedMonths: unique,
    range: {
      startLocalDateTime: `${startYear}-${pad(startMonth)}-01T00:00`,
      endLocalDateTime: `${next[0]}-${pad(next[1])}-01T00:00`,
      timezone,
      granularity,
      sourceText,
    },
  };
}

function monthKey(startYear: number, ordinalMonth: number) {
  const zeroBased = ordinalMonth - 1;
  return formatMonth(startYear + Math.floor(zeroBased / 12), zeroBased % 12 + 1);
}

function formatMonth(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseChineseOrArabicNumber(value: string) {
  return /^\d+$/.test(value) ? Number(value) : CHINESE_NUMBERS[value] || 0;
}

function rangeLimitMessage(): DynamicTargetParseResult {
  return { status: "clarification", message: "单次最多分析 10 年或 120 个月，请缩小时间范围。" };
}

function legacyMessage(): DynamicConsultContextResult {
  return {
    status: "clarification",
    message: "这是旧版命盘，不能静默套用新时间规则。请返回结果页按 v2 新口径重新测算后再查询动态月份。",
  };
}

function unwrapChart(value: unknown): unknown {
  return isRecord(value) && "chart" in value ? value.chart : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
