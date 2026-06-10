import type { ZhouyiTimeChart } from "./zhouyi";
import type { TarotChart } from "./tarot";
import type { ZiweiChart } from "./ziwei";

export type FortuneGender = "male" | "female" | "other";
export type FortuneCalendar = "gregorian";
export type FortuneMethod = "bazi" | "ziwei" | "zhouyi" | "tarot";
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

export interface CalculationBasis {
  library: string;
  libraryVersion: string;
  ruleSet: "opencat-ziping-v1";
  birthCalendar: FortuneCalendar;
  timeBasis: "standard" | "trueSolar";
  originalBirthDateTimeLocal: string;
  effectiveBirthDateTimeLocal: string;
  queryDateTimeLocal: string;
  timezone: string;
  longitude: number;
  latitude: number;
  trueSolarOffsetMinutes: number;
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
  calculationBasis: CalculationBasis;
}

export interface FortuneCompositeChart {
  bazi: BaziChart;
  zhouyi?: ZhouyiTimeChart;
  ziwei?: ZiweiChart;
  tarot?: TarotChart;
}
