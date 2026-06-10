import { Solar, type DaYun, type EightChar, type JieQi, type Lunar } from "lunar-typescript";
import { FORTUNE_LOCATIONS, getFortuneLocationById } from "./locations";
import type {
  AnnualFortune,
  BaziChart,
  BaziPillar,
  FiveElement,
  FiveElementBalance,
  FortuneInput,
  FortuneLocation,
  HiddenStem,
  LuckCycle,
  LuckDirection,
  SolarTermSnapshot,
  YinYang,
} from "./types";

export { FORTUNE_LOCATIONS, getFortuneLocationById };
export type { BaziChart, FortuneInput, FortuneLocation } from "./types";

export class FortuneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortuneValidationError";
  }
}

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const STEM_ELEMENT: Record<string, FiveElement> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
};

const BRANCH_ELEMENT: Record<string, FiveElement> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
};

const ELEMENT_CN: Record<FiveElement, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

const STEM_YINYANG: Record<string, YinYang> = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
};

const HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "戊", "庚"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

const NA_YIN = [
  "海中金", "海中金", "炉中火", "炉中火", "大林木", "大林木", "路旁土", "路旁土", "剑锋金", "剑锋金",
  "山头火", "山头火", "涧下水", "涧下水", "城头土", "城头土", "白蜡金", "白蜡金", "杨柳木", "杨柳木",
  "泉中水", "泉中水", "屋上土", "屋上土", "霹雳火", "霹雳火", "松柏木", "松柏木", "长流水", "长流水",
  "砂石金", "砂石金", "山下火", "山下火", "平地木", "平地木", "壁上土", "壁上土", "金箔金", "金箔金",
  "覆灯火", "覆灯火", "天河水", "天河水", "大驿土", "大驿土", "钗钏金", "钗钏金", "桑柘木", "桑柘木",
  "大溪水", "大溪水", "沙中土", "沙中土", "天上火", "天上火", "石榴木", "石榴木", "大海水", "大海水",
] as const;

const STEM_COMBOS: Record<string, string> = {
  甲己: "甲己合土",
  乙庚: "乙庚合金",
  丙辛: "丙辛合水",
  丁壬: "丁壬合木",
  戊癸: "戊癸合火",
};

const BRANCH_CONFLICTS: Record<string, string> = {
  子午: "子午冲",
  丑未: "丑未冲",
  寅申: "寅申冲",
  卯酉: "卯酉冲",
  辰戌: "辰戌冲",
  巳亥: "巳亥冲",
};

const BRANCH_LIUHE: Record<string, string> = {
  子丑: "子丑合土",
  寅亥: "寅亥合木",
  卯戌: "卯戌合火",
  辰酉: "辰酉合金",
  巳申: "巳申合水",
  午未: "午未合土",
};

const BRANCH_HARM: Record<string, string> = {
  子未: "子未害",
  丑午: "丑午害",
  寅巳: "寅巳害",
  卯辰: "卯辰害",
  申亥: "申亥害",
  酉戌: "酉戌害",
};

const BRANCH_BREAK: Record<string, string> = {
  子酉: "子酉破",
  丑辰: "丑辰破",
  寅亥: "寅亥破",
  卯午: "卯午破",
  巳申: "巳申破",
  未戌: "未戌破",
};

const SANHE_GROUPS = [
  { branches: ["申", "子", "辰"], text: "申子辰三合水局" },
  { branches: ["亥", "卯", "未"], text: "亥卯未三合木局" },
  { branches: ["寅", "午", "戌"], text: "寅午戌三合火局" },
  { branches: ["巳", "酉", "丑"], text: "巳酉丑三合金局" },
];

const SEASON_SUPPORT: Record<string, FiveElement[]> = {
  寅: ["wood", "fire"],
  卯: ["wood"],
  辰: ["earth", "wood"],
  巳: ["fire", "earth"],
  午: ["fire", "earth"],
  未: ["earth", "fire"],
  申: ["metal", "water"],
  酉: ["metal"],
  戌: ["earth", "metal"],
  亥: ["water", "wood"],
  子: ["water"],
  丑: ["earth", "water"],
};

export function validateFortuneInput(input: FortuneInput): FortuneInput {
  if (!input.profileName?.trim()) throw new FortuneValidationError("请输入姓名");
  if (!["male", "female", "other"].includes(input.gender)) throw new FortuneValidationError("性别参数无效");
  if (input.birthCalendar !== "gregorian") throw new FortuneValidationError("首版仅支持公历出生日期");
  if (!input.modelId?.trim()) throw new FortuneValidationError("请选择解读模型");
  validateLocation(input.birthLocation);

  const birth = parseLocalDateTime(input.birthDateTimeLocal);
  const query = parseLocalDateTime(input.queryDateTimeLocal);
  if (birth.getTime() > query.getTime()) {
    throw new FortuneValidationError("出生时间不能晚于测算时间");
  }
  if (birth.getFullYear() < 1900 || birth.getFullYear() > 2100) {
    throw new FortuneValidationError("出生年份需在 1900 至 2100 年之间");
  }
  return {
    ...input,
    profileName: input.profileName.trim(),
    modelId: input.modelId.trim(),
  };
}

export function buildBaziChart(rawInput: FortuneInput): BaziChart {
  const input = validateFortuneInput(rawInput);
  const originalBirth = parseLocalDateTime(input.birthDateTimeLocal);
  const queryDate = parseLocalDateTime(input.queryDateTimeLocal);
  const trueSolarOffsetMinutes = input.useTrueSolarTime
    ? Math.round((input.birthLocation.longitude - timezoneStandardLongitude(input.birthLocation.timezone)) * 4)
    : 0;
  const effectiveBirth = addMinutes(originalBirth, trueSolarOffsetMinutes);
  const lunarContext = getLunarContext(effectiveBirth);
  const solarTerms = getSolarTermSnapshotFromLunar(lunarContext.lunar);
  const pillars = getPillarsFromLunar(lunarContext.eightChar);
  const fiveElementBalance = getFiveElementBalance(pillars);
  const tenGodSummary = getTenGodSummary(pillars);
  const relations = getRelations(pillars);
  const shenSha = getShenSha(pillars);
  const dayMasterStrength = getDayMasterStrength(pillars, fiveElementBalance);
  const pattern = getPattern(pillars, dayMasterStrength, fiveElementBalance);
  const luckCycles = getLuckCycles(input, pillars, lunarContext.eightChar, queryDate);
  const annualFortune = getAnnualFortune(queryDate, pillars.day.stem);

  return {
    profileName: input.profileName,
    gender: input.gender,
    pillars,
    zodiac: lunarContext.lunar.getYearShengXiaoExact?.() || lunarContext.lunar.getYearShengXiao?.() || "",
    lunarDate: getLunarDate(lunarContext.lunar),
    solarTerms,
    fiveElementBalance,
    tenGodSummary,
    relations,
    shenSha,
    dayMasterStrength,
    pattern,
    luckCycles,
    annualFortune,
    calculationBasis: {
      library: "lunar-typescript",
      libraryVersion: "1.7.8",
      ruleSet: "opencat-ziping-v1",
      birthCalendar: input.birthCalendar,
      timeBasis: input.useTrueSolarTime ? "trueSolar" : "standard",
      originalBirthDateTimeLocal: formatLocalDateTime(originalBirth),
      effectiveBirthDateTimeLocal: formatLocalDateTime(effectiveBirth),
      queryDateTimeLocal: formatLocalDateTime(queryDate),
      timezone: input.birthLocation.timezone,
      longitude: input.birthLocation.longitude,
      latitude: input.birthLocation.latitude,
      trueSolarOffsetMinutes,
      locationName: input.birthLocation.name,
    },
  };
}

function validateLocation(location: FortuneLocation) {
  if (!location?.name?.trim()) throw new FortuneValidationError("请选择或填写出生地区");
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new FortuneValidationError("经度必须在 -180 到 180 之间");
  }
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new FortuneValidationError("纬度必须在 -90 到 90 之间");
  }
  if (!location.timezone?.trim()) throw new FortuneValidationError("请选择时区");
}

function parseLocalDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new FortuneValidationError("日期时间格式无效");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new FortuneValidationError("日期时间格式无效");
  return date;
}

function timezoneStandardLongitude(timezone: string) {
  const offsets: Record<string, number> = {
    "Asia/Shanghai": 120,
    "Asia/Hong_Kong": 120,
    "Asia/Taipei": 120,
    "Asia/Tokyo": 135,
    "Asia/Singapore": 120,
    "America/New_York": -75,
    "America/Los_Angeles": -120,
    "Europe/London": 0,
  };
  return offsets[timezone] ?? 120;
}

function getLunarContext(date: Date) {
  const solar = Solar.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    0
  );
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  return { solar, lunar, eightChar };
}

function getPillarsFromLunar(eightChar: EightChar): BaziChart["pillars"] {
  const dayStem = eightChar.getDayGan();
  return {
    year: makePillarFromLunar("year", {
      stemBranch: eightChar.getYear(),
      hiddenStems: eightChar.getYearHideGan(),
      naYin: eightChar.getYearNaYin(),
      tenGodGan: eightChar.getYearShiShenGan(),
      tenGodZhi: eightChar.getYearShiShenZhi(),
    }, dayStem),
    month: makePillarFromLunar("month", {
      stemBranch: eightChar.getMonth(),
      hiddenStems: eightChar.getMonthHideGan(),
      naYin: eightChar.getMonthNaYin(),
      tenGodGan: eightChar.getMonthShiShenGan(),
      tenGodZhi: eightChar.getMonthShiShenZhi(),
    }, dayStem),
    day: {
      ...makePillarFromLunar("day", {
        stemBranch: eightChar.getDay(),
        hiddenStems: eightChar.getDayHideGan(),
        naYin: eightChar.getDayNaYin(),
        tenGodGan: "日主",
        tenGodZhi: eightChar.getDayShiShenZhi(),
      }, dayStem),
      tenGod: "日主",
    },
    hour: makePillarFromLunar("hour", {
      stemBranch: eightChar.getTime(),
      hiddenStems: eightChar.getTimeHideGan(),
      naYin: eightChar.getTimeNaYin(),
      tenGodGan: eightChar.getTimeShiShenGan(),
      tenGodZhi: eightChar.getTimeShiShenZhi(),
    }, dayStem),
  };
}

function makePillarFromLunar(
  name: BaziPillar["name"],
  data: {
    stemBranch: string;
    hiddenStems: string[];
    naYin: string;
    tenGodGan: string;
    tenGodZhi: string[];
  },
  dayStem: string
): BaziPillar {
  const stem = data.stemBranch.slice(0, 1);
  const branch = data.stemBranch.slice(1, 2);
  return {
    name,
    stem,
    branch,
    stemBranch: data.stemBranch,
    element: STEM_ELEMENT[stem],
    yinYang: STEM_YINYANG[stem],
    tenGod: data.tenGodGan || getTenGod(dayStem, stem),
    hiddenStems: data.hiddenStems.map((hiddenStem, index) => ({
      stem: hiddenStem,
      element: STEM_ELEMENT[hiddenStem],
      yinYang: STEM_YINYANG[hiddenStem],
      tenGod: data.tenGodZhi[index] || getTenGod(dayStem, hiddenStem),
    })),
    naYin: data.naYin,
  };
}

function makePillar(name: BaziPillar["name"], index: number, dayStem: string): BaziPillar {
  return makePillarFromStemBranch(name, STEMS[mod(index, 10)], BRANCHES[mod(index, 12)], dayStem);
}

function makePillarFromStemBranch(
  name: BaziPillar["name"],
  stem: string,
  branch: string,
  dayStem: string
): BaziPillar {
  const cycleIndex = getCycleIndex(stem, branch);
  const hiddenStems = (HIDDEN_STEMS[branch] || []).map((hiddenStem) => makeHiddenStem(hiddenStem, dayStem));
  return {
    name,
    stem,
    branch,
    stemBranch: `${stem}${branch}`,
    element: STEM_ELEMENT[stem],
    yinYang: STEM_YINYANG[stem],
    tenGod: getTenGod(dayStem, stem),
    hiddenStems,
    naYin: NA_YIN[cycleIndex] || "未知纳音",
  };
}

function makeHiddenStem(stem: string, dayStem: string): HiddenStem {
  return {
    stem,
    element: STEM_ELEMENT[stem],
    yinYang: STEM_YINYANG[stem],
    tenGod: getTenGod(dayStem, stem),
  };
}

function getTenGod(dayStem: string, targetStem: string) {
  if (dayStem === targetStem) return "比肩";
  const dayElement = STEM_ELEMENT[dayStem];
  const targetElement = STEM_ELEMENT[targetStem];
  const sameYinYang = STEM_YINYANG[dayStem] === STEM_YINYANG[targetStem];
  if (dayElement === targetElement) return sameYinYang ? "比肩" : "劫财";
  if (generates(dayElement) === targetElement) return sameYinYang ? "食神" : "伤官";
  if (generates(targetElement) === dayElement) return sameYinYang ? "偏印" : "正印";
  if (controls(dayElement) === targetElement) return sameYinYang ? "偏财" : "正财";
  if (controls(targetElement) === dayElement) return sameYinYang ? "七杀" : "正官";
  return "未知";
}

function generates(element: FiveElement): FiveElement {
  return ({ wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" } as const)[element];
}

function controls(element: FiveElement): FiveElement {
  return ({ wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" } as const)[element];
}

function getCycleIndex(stem: string, branch: string) {
  for (let i = 0; i < 60; i++) {
    if (STEMS[mod(i, 10)] === stem && BRANCHES[mod(i, 12)] === branch) return i;
  }
  return 0;
}

function getFiveElementBalance(pillars: BaziChart["pillars"]): FiveElementBalance {
  const balance: Record<FiveElement, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pillar of Object.values(pillars)) {
    balance[STEM_ELEMENT[pillar.stem]] += 1;
    balance[BRANCH_ELEMENT[pillar.branch]] += 1;
  }
  const values = Object.values(balance);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return {
    ...balance,
    total: values.reduce((sum, value) => sum + value, 0),
    strongest: elementKeys().filter((element) => balance[element] === max),
    weakest: elementKeys().filter((element) => balance[element] === min),
  };
}

function getTenGodSummary(pillars: BaziChart["pillars"]) {
  const summary: Record<string, number> = {};
  for (const pillar of Object.values(pillars)) {
    summary[pillar.tenGod] = (summary[pillar.tenGod] || 0) + 1;
    for (const hidden of pillar.hiddenStems) {
      summary[hidden.tenGod] = (summary[hidden.tenGod] || 0) + 0.5;
    }
  }
  return summary;
}

function getRelations(pillars: BaziChart["pillars"]) {
  const relations = new Set<string>();
  const pillarValues = Object.values(pillars);
  for (let i = 0; i < pillarValues.length; i++) {
    for (let j = i + 1; j < pillarValues.length; j++) {
      const stems = sortPair(pillarValues[i].stem, pillarValues[j].stem);
      const branches = sortPair(pillarValues[i].branch, pillarValues[j].branch);
      if (STEM_COMBOS[stems]) relations.add(STEM_COMBOS[stems]);
      if (BRANCH_CONFLICTS[branches]) relations.add(BRANCH_CONFLICTS[branches]);
      if (BRANCH_LIUHE[branches]) relations.add(BRANCH_LIUHE[branches]);
      if (BRANCH_HARM[branches]) relations.add(BRANCH_HARM[branches]);
      if (BRANCH_BREAK[branches]) relations.add(BRANCH_BREAK[branches]);
    }
  }
  const branchSet = new Set(pillarValues.map((pillar) => pillar.branch));
  for (const group of SANHE_GROUPS) {
    if (group.branches.every((branch) => branchSet.has(branch))) relations.add(group.text);
  }
  return [...relations];
}

function sortPair(a: string, b: string) {
  return [a, b].sort((left, right) => allSymbolsIndex(left) - allSymbolsIndex(right)).join("");
}

function allSymbolsIndex(value: string) {
  const stemIndex = STEMS.indexOf(value as (typeof STEMS)[number]);
  if (stemIndex >= 0) return stemIndex;
  return BRANCHES.indexOf(value as (typeof BRANCHES)[number]);
}

function getShenSha(pillars: BaziChart["pillars"]) {
  const result = new Set<string>();
  const branches = Object.values(pillars).map((pillar) => pillar.branch);
  const dayBranch = pillars.day.branch;
  const noble = getTianyiNobleBranches(pillars.day.stem);
  for (const branch of branches) {
    if (noble.includes(branch)) result.add(`天乙贵人见${branch}`);
    if (branch === "午" && ["申", "子", "辰"].includes(dayBranch)) result.add("桃花");
    if (branch === "卯" && ["寅", "午", "戌"].includes(dayBranch)) result.add("桃花");
    if (branch === "子" && ["巳", "酉", "丑"].includes(dayBranch)) result.add("桃花");
    if (branch === "酉" && ["亥", "卯", "未"].includes(dayBranch)) result.add("桃花");
    if (branch === "寅" && ["申", "子", "辰"].includes(dayBranch)) result.add("驿马");
    if (branch === "申" && ["寅", "午", "戌"].includes(dayBranch)) result.add("驿马");
    if (branch === "亥" && ["巳", "酉", "丑"].includes(dayBranch)) result.add("驿马");
    if (branch === "巳" && ["亥", "卯", "未"].includes(dayBranch)) result.add("驿马");
  }
  result.add(`日主${pillars.day.stem}${ELEMENT_CN[STEM_ELEMENT[pillars.day.stem]]}`);
  return [...result];
}

function getTianyiNobleBranches(dayStem: string) {
  const map: Record<string, string[]> = {
    甲: ["丑", "未"],
    戊: ["丑", "未"],
    庚: ["丑", "未"],
    乙: ["子", "申"],
    己: ["子", "申"],
    丙: ["亥", "酉"],
    丁: ["亥", "酉"],
    壬: ["卯", "巳"],
    癸: ["卯", "巳"],
    辛: ["午", "寅"],
  };
  return map[dayStem] || [];
}

function getDayMasterStrength(pillars: BaziChart["pillars"], balance: FiveElementBalance) {
  const dayElement = STEM_ELEMENT[pillars.day.stem];
  const monthBranch = pillars.month.branch;
  let score = balance[dayElement] * 2;
  if (SEASON_SUPPORT[monthBranch]?.includes(dayElement)) score += 3;
  const supportElement = generates(dayElement);
  const motherElement = elementKeys().find((element) => generates(element) === dayElement);
  if (motherElement) score += balance[motherElement];
  score -= balance[controls(dayElement)] * 0.8;
  score -= balance[supportElement] * 0.3;
  const level: "strong" | "balanced" | "weak" = score >= 6 ? "strong" : score <= 3 ? "weak" : "balanced";
  const cnLevel = level === "strong" ? "偏旺" : level === "weak" ? "偏弱" : "中和";
  return {
    level,
    score: Number(score.toFixed(1)),
    explanation: `日主${pillars.day.stem}${ELEMENT_CN[dayElement]}，月令${monthBranch}，按 opencat-ziping-v1 估算为${cnLevel}。`,
  };
}

function getPattern(pillars: BaziChart["pillars"], strength: ReturnType<typeof getDayMasterStrength>, balance: FiveElementBalance) {
  const monthMainStem = pillars.month.hiddenStems[0]?.stem || pillars.month.stem;
  const monthGod = getTenGod(pillars.day.stem, monthMainStem);
  const dayElement = STEM_ELEMENT[pillars.day.stem];
  const usefulElements =
    strength.level === "strong"
      ? [generates(dayElement), controls(dayElement)]
      : strength.level === "weak"
        ? [dayElement, elementKeys().find((element) => generates(element) === dayElement) || dayElement]
        : balance.weakest;
  return {
    name: `${monthGod}格倾向`,
    usefulElements: [...new Set(usefulElements)],
    note: "格局与用神流派差异较大，首版按月令主气和日主强弱给出项目默认判定。",
  };
}

function getLuckCycles(
  input: FortuneInput,
  pillars: BaziChart["pillars"],
  eightChar: EightChar,
  queryDate: Date
): LuckCycle[] {
  const genderNumber = input.gender === "female" ? 0 : 1;
  const yun = eightChar.getYun(genderNumber, 1);
  const direction: LuckDirection = yun.isForward() ? "forward" : "backward";
  const birthYear = eightChar.getLunar().getSolar().getYear();
  const cycles: LuckCycle[] = yun.getDaYun(10)
    .filter((daYun: DaYun) => daYun.getGanZhi())
    .map((daYun: DaYun) => ({
      index: daYun.getIndex(),
      direction,
      startAge: daYun.getStartAge(),
      endAge: daYun.getEndAge(),
      startYear: daYun.getStartYear(),
      endYear: daYun.getEndYear(),
      pillar: makePillarFromStemBranch("month", daYun.getGanZhi().slice(0, 1), daYun.getGanZhi().slice(1, 2), pillars.day.stem),
    }));
  const currentAge = Math.max(0, queryDate.getFullYear() - birthYear);
  return cycles.map((cycle) => ({
    ...cycle,
    pillar: {
      ...cycle.pillar,
      tenGod: cycle.startAge <= currentAge && currentAge <= cycle.endAge
        ? `${cycle.pillar.tenGod}（当前大运）`
        : cycle.pillar.tenGod,
    },
  }));
}

function getAnnualFortune(queryDate: Date, dayStem: string): AnnualFortune {
  const index = mod(queryDate.getFullYear() - 1984, 60);
  const pillar = makePillar("annual", index, dayStem);
  return {
    year: queryDate.getFullYear(),
    pillar,
    relationToDayMaster: `流年${pillar.stemBranch}为${pillar.tenGod}透出，地支${pillar.branch}${ELEMENT_CN[BRANCH_ELEMENT[pillar.branch]]}参与岁运作用。`,
  };
}

function getSolarTermSnapshotFromLunar(lunar: Lunar): BaziChart["solarTerms"] {
  const previous = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();
  const monthBoundaryUsed = lunar.getPrevJie();
  return {
    previous: toJieQiSnapshot(previous),
    next: toJieQiSnapshot(next),
    monthBoundaryUsed: toJieQiSnapshot(monthBoundaryUsed),
  };
}

function toJieQiSnapshot(jieQi: JieQi): SolarTermSnapshot {
  return {
    name: jieQi.getName(),
    dateTimeLocal: solarToLocalDateTime(jieQi.getSolar()),
  };
}

function getLunarDate(lunar: Lunar) {
  return {
    text: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
  };
}

function solarToLocalDateTime(solar: Solar) {
  return `${solar.getYear()}-${parsePad(solar.getMonth())}-${parsePad(solar.getDay())}T${parsePad(solar.getHour())}:${parsePad(solar.getMinute())}`;
}

function parsePad(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${parsePad(date.getMonth() + 1)}-${parsePad(date.getDate())}T${parsePad(date.getHours())}:${parsePad(date.getMinutes())}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function elementKeys(): FiveElement[] {
  return ["wood", "fire", "earth", "metal", "water"];
}
