import type { ZhouyiTimeChart } from "./zhouyi";
import type { TarotChart } from "./tarot";
import type { ZiweiChart } from "./ziwei";
import type { XiaoliurenChart } from "./xiaoliuren";

export type FortuneGender = "male" | "female" | "other";
export type FortuneCalendar = "gregorian";
export type FortuneMethod = "bazi" | "ziwei" | "zhouyi" | "tarot" | "xiaoliuren";
export type YinYang = "yang" | "yin";
export type FiveElement = "wood" | "fire" | "earth" | "metal" | "water";
export type LuckDirection = "forward" | "backward";

export interface FortuneLocation {
  id?: string;
  name: string;
  longitude: number;
  latitude: number;
  timezone: string;
}

export interface FortuneInput {
  method: FortuneMethod;
  profileName: string;
  gender: FortuneGender;
  birthCalendar: FortuneCalendar;
  birthDateTimeLocal: string;
  birthLocation: FortuneLocation;
  useTrueSolarTime: boolean;
  queryDateTimeLocal: string;
  modelId: string;
}

export interface HiddenStem {
  stem: string;
  element: FiveElement;
  yinYang: YinYang;
  tenGod: string;
}

export interface BaziPillar {
  name: "year" | "month" | "day" | "hour" | "annual";
  stem: string;
  branch: string;
  stemBranch: string;
  element: FiveElement;
  yinYang: YinYang;
  tenGod: string;
  hiddenStems: HiddenStem[];
  naYin: string;
}

export interface SolarTermSnapshot {
  name: string;
  dateTimeLocal: string;
}

export interface FiveElementBalance {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
  total: number;
  strongest: FiveElement[];
  weakest: FiveElement[];
}

export interface LuckCycle {
  index: number;
  direction: LuckDirection;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  pillar: BaziPillar;
}

export interface AnnualFortune {
  year: number;
  pillar: BaziPillar;
  relationToDayMaster: string;
}

export interface DynamicTargetRange {
  startLocalDateTime: string;
  endLocalDateTime: string;
  timezone: string;
  granularity: "year" | "month" | "day";
  sourceText?: string;
}

export interface BaziMonthSegment {
  gregorianMonth: string;
  startLocalDateTime: string;
  endLocalDateTime: string;
  solarTermBoundary?: SolarTermSnapshot;
  pillar: BaziPillar;
  relations: string[];
}

export interface BaziDynamicContext {
  method: "bazi";
  targetRange: DynamicTargetRange;
  annualFortunes: AnnualFortune[];
  currentLuckCycle: LuckCycle | null;
  monthSegments: BaziMonthSegment[];
}

export interface ZiweiHoroscopeItem {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  palaceNames: string[];
  mutagen: string[];
  stars: ZiweiStarPlacement[][];
}

export interface ZiweiStarPlacement {
  name: string;
  type: string;
  scope: string;
}

export interface ZiweiDynamicContext {
  method: "ziwei";
  targetRange: DynamicTargetRange;
  solarDate: string;
  lunarDate: string;
  decadal: ZiweiHoroscopeItem;
  age: ZiweiHoroscopeItem & { nominalAge: number };
  yearly: ZiweiHoroscopeItem & {
    yearlyDecStar: { jiangqian12: string[]; suiqian12: string[] };
  };
  monthly: ZiweiHoroscopeItem;
  daily: ZiweiHoroscopeItem;
}

export type FortuneDynamicContext = BaziDynamicContext | ZiweiDynamicContext;

export interface CalculationBasis {
  library: string;
  libraryVersion: string;
  ruleSet: "opencat-ziping-v1" | "opencat-ziping-v2";
  birthCalendar: FortuneCalendar;
  timeBasis: "standard" | "trueSolar";
  originalBirthDateTimeLocal: string;
  effectiveBirthDateTimeLocal: string;
  queryDateTimeLocal: string;
  timezone: string;
  longitude: number;
  latitude: number;
  trueSolarOffsetMinutes: number;
  timezoneOffsetMinutes?: number;
  standardMeridianLongitude?: number;
  longitudeOffsetMinutes?: number;
  equationOfTimeMinutes?: number;
  yearBoundary?: "li-chun";
  monthBoundary?: "solar-terms";
  locationName: string;
}

export interface BaziChart {
  profileName: string;
  gender: FortuneGender;
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    hour: BaziPillar;
  };
  zodiac: string;
  lunarDate: {
    text: string;
    year: number;
    month: number;
    day: number;
  };
  solarTerms: {
    previous: SolarTermSnapshot;
    next: SolarTermSnapshot;
    monthBoundaryUsed: SolarTermSnapshot;
  };
  fiveElementBalance: FiveElementBalance;
  tenGodSummary: Record<string, number>;
  relations: string[];
  shenSha: string[];
  dayMasterStrength: {
    level: "strong" | "balanced" | "weak";
    score: number;
    explanation: string;
  };
  pattern: {
    name: string;
    usefulElements: FiveElement[];
    note: string;
  };
  luckCycles: LuckCycle[];
  annualFortune: AnnualFortune;
  dynamicContext: BaziDynamicContext;
  calculationBasis: CalculationBasis;
}

export interface FortuneCompositeChart {
  bazi: BaziChart;
  zhouyi?: ZhouyiTimeChart;
  ziwei?: ZiweiChart;
  tarot?: TarotChart;
  xiaoliuren?: XiaoliurenChart;
}
