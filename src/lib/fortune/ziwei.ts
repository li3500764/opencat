import { astro } from "iztro";
import { validateFortuneInput } from "./chart";
import { addLocalMinutes, applyTrueSolarTime, formatPlainDateTime, parsePlainLocalDateTime, parseZonedLocalDateTime } from "./time";
import type { FortuneGender, FortuneInput, ZiweiDynamicContext, ZiweiHoroscopeItem } from "./types";

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
  dynamicContext: ZiweiDynamicContext;
  calculationBasis: {
    ruleSet: "opencat-ziwei-v1" | "opencat-ziwei-v2";
    library: "iztro";
    libraryVersion: "2.5.8";
    language: "zh-CN";
    fixLeap: true;
    timeBasis: "standard" | "trueSolar";
    originalBirthDateTimeLocal: string;
    effectiveBirthDateTimeLocal: string;
    queryDateTimeLocal: string;
    trueSolarOffsetMinutes: number;
    timezoneOffsetMinutes?: number;
    standardMeridianLongitude?: number;
    longitudeOffsetMinutes?: number;
    equationOfTimeMinutes?: number;
    yearDivide?: "normal";
    horoscopeDivide?: "normal";
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
  const originalBirth = parseZonedLocalDateTime(input.birthDateTimeLocal, input.birthLocation.timezone);
  const solarCorrection = input.useTrueSolarTime
    ? applyTrueSolarTime({
        localDateTime: originalBirth.localDateTime,
        timeZone: input.birthLocation.timezone,
        longitude: input.birthLocation.longitude,
      })
    : {
        originalLocalDateTime: originalBirth.localDateTime,
        effectiveLocalDateTime: originalBirth.localDateTime,
        timezoneOffsetMinutes: originalBirth.offsetMinutes,
        standardMeridianLongitude: (originalBirth.offsetMinutes / 60) * 15,
        longitudeOffsetMinutes: 0,
        equationOfTimeMinutes: 0,
        totalOffsetMinutes: 0,
      };
  const effectiveBirth = parsePlainLocalDateTime(solarCorrection.effectiveLocalDateTime);
  const queryDate = parseZonedLocalDateTime(input.queryDateTimeLocal, input.birthLocation.timezone);
  const solarDate = `${effectiveBirth.year}-${effectiveBirth.month}-${effectiveBirth.day}`;
  const timeIndex = getIztroTimeIndex({ hour: effectiveBirth.hour });
  const gender = input.gender === "female" ? "女" : "男";
  const astrolabe = astro.bySolar(solarDate, timeIndex, gender, true, "zh-CN");
  const dynamicContext = buildZiweiDynamicContext(
    astrolabe,
    queryDate.localDateTime,
    input.birthLocation.timezone
  );

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
    dynamicContext,
    calculationBasis: {
      ruleSet: "opencat-ziwei-v2",
      library: "iztro",
      libraryVersion: "2.5.8",
      language: "zh-CN",
      fixLeap: true,
      timeBasis: input.useTrueSolarTime ? "trueSolar" : "standard",
      originalBirthDateTimeLocal: originalBirth.localDateTime,
      effectiveBirthDateTimeLocal: formatPlainDateTime(effectiveBirth),
      queryDateTimeLocal: queryDate.localDateTime,
      trueSolarOffsetMinutes: solarCorrection.totalOffsetMinutes,
      timezoneOffsetMinutes: solarCorrection.timezoneOffsetMinutes,
      standardMeridianLongitude: solarCorrection.standardMeridianLongitude,
      longitudeOffsetMinutes: solarCorrection.longitudeOffsetMinutes,
      equationOfTimeMinutes: solarCorrection.equationOfTimeMinutes,
      yearDivide: "normal",
      horoscopeDivide: "normal",
      timeIndex,
      locationName: input.birthLocation.name,
      longitude: input.birthLocation.longitude,
      latitude: input.birthLocation.latitude,
      timezone: input.birthLocation.timezone,
    },
  };
}

export function buildZiweiDynamicContext(
  astrolabe: IztroAstrolabe,
  targetLocalDateTime: string,
  timezone: string
): ZiweiDynamicContext {
  const target = parsePlainLocalDateTime(targetLocalDateTime);
  const targetDate = `${target.year}-${target.month}-${target.day}`;
  const horoscope = astrolabe.horoscope(targetDate, getIztroTimeIndex({ hour: target.hour }));
  return {
    method: "ziwei",
    targetRange: {
      startLocalDateTime: `${target.year}-${parsePad(target.month)}-${parsePad(target.day)}T00:00`,
      endLocalDateTime: addLocalMinutes(`${target.year}-${parsePad(target.month)}-${parsePad(target.day)}T00:00`, 1440),
      timezone,
      granularity: "day",
    },
    solarDate: horoscope.solarDate,
    lunarDate: horoscope.lunarDate,
    decadal: normalizeHoroscopeItem(horoscope.decadal),
    age: { ...normalizeHoroscopeItem(horoscope.age), nominalAge: horoscope.age.nominalAge },
    yearly: {
      ...normalizeHoroscopeItem(horoscope.yearly),
      yearlyDecStar: {
        jiangqian12: [...horoscope.yearly.yearlyDecStar.jiangqian12],
        suiqian12: [...horoscope.yearly.yearlyDecStar.suiqian12],
      },
    },
    monthly: normalizeHoroscopeItem(horoscope.monthly),
    daily: normalizeHoroscopeItem(horoscope.daily),
  };
}

function normalizeHoroscopeItem(item: {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  palaceNames: readonly string[];
  mutagen: readonly string[];
  stars?: readonly (readonly { name: string; type: string; scope: string }[])[];
}): ZiweiHoroscopeItem {
  return {
    index: item.index,
    name: item.name,
    heavenlyStem: item.heavenlyStem,
    earthlyBranch: item.earthlyBranch,
    palaceNames: [...item.palaceNames],
    mutagen: [...item.mutagen],
    stars: Array.from({ length: 12 }, (_, index) =>
      (item.stars?.[index] || []).map((star) => ({ name: star.name, type: star.type, scope: star.scope }))
    ),
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

export function getIztroTimeIndex(date: Date | { hour: number }) {
  const hour = date instanceof Date ? date.getHours() : date.hour;
  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

function parsePad(value: number) {
  return String(value).padStart(2, "0");
}
