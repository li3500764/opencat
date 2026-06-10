import { astro } from "iztro";
import { validateFortuneInput } from "./chart";
import type { FortuneGender, FortuneInput } from "./types";

export interface ZiweiStar {
  name: string;
  type: string;
  scope: string;
  brightness?: string;
  mutagen?: string;
}

export interface ZiweiPalace {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  majorStars: ZiweiStar[];
  minorStars: ZiweiStar[];
  adjectiveStars: ZiweiStar[];
  changsheng12: string;
  boshi12: string;
  jiangqian12: string;
  suiqian12: string;
  decadal: {
    range: [number, number];
    heavenlyStem: string;
    earthlyBranch: string;
  };
  ages: number[];
}

export interface ZiweiChart {
  method: "ziwei-astrolabe";
  profileName: string;
  gender: FortuneGender;
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  timeIndex: number;
  time: string;
  timeRange: string;
  sign: string;
  zodiac: string;
  earthlyBranchOfSoulPalace: string;
  earthlyBranchOfBodyPalace: string;
  soul: string;
  body: string;
  fiveElementsClass: string;
  palaces: ZiweiPalace[];
  calculationBasis: {
    ruleSet: "opencat-ziwei-v1";
    library: "iztro";
    libraryVersion: "2.5.8";
    language: "zh-CN";
    fixLeap: true;
    timeBasis: "standard" | "trueSolar";
    originalBirthDateTimeLocal: string;
    effectiveBirthDateTimeLocal: string;
    trueSolarOffsetMinutes: number;
    timeIndex: number;
    locationName: string;
    longitude: number;
    latitude: number;
    timezone: string;
  };
}

type IztroAstrolabe = ReturnType<typeof astro.bySolar>;

export function buildZiweiChart(rawInput: FortuneInput): ZiweiChart {
  const input = validateFortuneInput(rawInput);
  const originalBirth = parseLocalDateTime(input.birthDateTimeLocal);
  const trueSolarOffsetMinutes = input.useTrueSolarTime
    ? Math.round((input.birthLocation.longitude - timezoneStandardLongitude(input.birthLocation.timezone)) * 4)
    : 0;
  const effectiveBirth = addMinutes(originalBirth, trueSolarOffsetMinutes);
  const solarDate = `${effectiveBirth.getFullYear()}-${effectiveBirth.getMonth() + 1}-${effectiveBirth.getDate()}`;
  const timeIndex = getIztroTimeIndex(effectiveBirth);
  const gender = input.gender === "female" ? "女" : "男";
  const astrolabe = astro.bySolar(solarDate, timeIndex, gender, true, "zh-CN");

  return {
    method: "ziwei-astrolabe",
    profileName: input.profileName,
    gender: input.gender,
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    timeIndex,
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,
    sign: astrolabe.sign,
    zodiac: astrolabe.zodiac,
    earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    palaces: astrolabe.palaces.map(normalizePalace),
    calculationBasis: {
      ruleSet: "opencat-ziwei-v1",
      library: "iztro",
      libraryVersion: "2.5.8",
      language: "zh-CN",
      fixLeap: true,
      timeBasis: input.useTrueSolarTime ? "trueSolar" : "standard",
      originalBirthDateTimeLocal: formatLocalDateTime(originalBirth),
      effectiveBirthDateTimeLocal: formatLocalDateTime(effectiveBirth),
      trueSolarOffsetMinutes,
      timeIndex,
      locationName: input.birthLocation.name,
      longitude: input.birthLocation.longitude,
      latitude: input.birthLocation.latitude,
      timezone: input.birthLocation.timezone,
    },
  };
}

function normalizePalace(palace: IztroAstrolabe["palaces"][number]): ZiweiPalace {
  return {
    index: palace.index,
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: palace.isBodyPalace,
    isOriginalPalace: palace.isOriginalPalace,
    majorStars: palace.majorStars.map(normalizeStar),
    minorStars: palace.minorStars.map(normalizeStar),
    adjectiveStars: palace.adjectiveStars.map(normalizeStar),
    changsheng12: palace.changsheng12,
    boshi12: palace.boshi12,
    jiangqian12: palace.jiangqian12,
    suiqian12: palace.suiqian12,
    decadal: {
      range: palace.decadal.range,
      heavenlyStem: palace.decadal.heavenlyStem,
      earthlyBranch: palace.decadal.earthlyBranch,
    },
    ages: palace.ages,
  };
}

function normalizeStar(star: ZiweiStar): ZiweiStar {
  return {
    name: star.name,
    type: star.type,
    scope: star.scope,
    brightness: star.brightness || undefined,
    mutagen: star.mutagen || undefined,
  };
}

export function getIztroTimeIndex(date: Date) {
  const hour = date.getHours();
  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

function parseLocalDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error("日期时间格式无效");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("日期时间格式无效");
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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function parsePad(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${parsePad(date.getMonth() + 1)}-${parsePad(date.getDate())}T${parsePad(date.getHours())}:${parsePad(date.getMinutes())}`;
}
