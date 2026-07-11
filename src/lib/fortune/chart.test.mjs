import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const {
  buildBaziChart,
  FortuneValidationError,
  getFortuneLocationById,
  validateFortuneInput,
} = jiti("./chart.ts");

test("buildBaziChart returns a stable full chart shape for a gregorian birth input", () => {
  const beijing = getFortuneLocationById("cn-beijing");
  const chart = buildBaziChart({
    profileName: "测试命主",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: beijing,
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });

  assert.equal(chart.calculationBasis.ruleSet, "opencat-ziping-v2");
  assert.equal(chart.calculationBasis.library, "lunar-typescript");
  assert.equal(chart.calculationBasis.timeBasis, "standard");
  assert.equal(chart.pillars.year.stemBranch, "庚午");
  assert.equal(chart.pillars.month.stemBranch, "辛巳");
  assert.equal(chart.pillars.day.stemBranch, "壬午");
  assert.equal(chart.pillars.hour.stemBranch, "甲辰");
  assert.equal(chart.pillars.month.tenGod, "正印");
  assert.equal(chart.pillars.day.tenGod, "日主");
  assert.equal(chart.lunarDate.text, "一九九〇年四月廿三");
  assert.equal(chart.solarTerms.previous.name, "立夏");
  assert.equal(chart.solarTerms.next.name, "小满");
  assert.equal(chart.pillars.hour.hiddenStems.length > 0, true);
  assert.equal(chart.fiveElementBalance.total, 8);
  assert.equal(chart.luckCycles.length >= 8, true);
  assert.equal(chart.luckCycles[2].pillar.stemBranch, "甲申");
  assert.match(chart.luckCycles[2].pillar.tenGod, /当前大运/);
  assert.equal(chart.annualFortune.year, 2026);
  assert.equal(chart.annualFortune.pillar.stemBranch, "丙午");
  assert.equal(chart.dynamicContext.method, "bazi");
  assert.equal(chart.dynamicContext.annualFortunes[0].pillar.stemBranch, "丙午");
  assert.equal(chart.dynamicContext.monthSegments.some((segment) => segment.gregorianMonth === "2026-07"), true);
  assert.equal(chart.dynamicContext.monthSegments.filter((segment) => segment.gregorianMonth === "2026-07").length, 2);
  assert.equal(chart.shenSha.length > 0, true);
});

test("annual fortune changes at Li Chun instead of Gregorian new year", () => {
  const chart = buildBaziChart({
    profileName: "测试命主",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: getFortuneLocationById("cn-beijing"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-01-15T12:00",
    modelId: "gpt-4o-mini",
  });

  assert.equal(chart.annualFortune.year, 2025);
  assert.equal(chart.annualFortune.pillar.stemBranch, "乙巳");
});

test("monthly segments expose exact solar-term boundaries for July through December", () => {
  const chart = buildBaziChart({
    profileName: "测试命主",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: getFortuneLocationById("cn-shanghai"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-07-11T12:00",
    modelId: "gpt-4o-mini",
  });

  for (const month of ["07", "08", "09", "10", "11", "12"]) {
    const segments = chart.dynamicContext.monthSegments.filter(
      (segment) => segment.gregorianMonth === `2026-${month}`
    );
    assert.equal(segments.length, 2);
    assert.equal(segments.every((segment) => segment.pillar.stemBranch.length === 2), true);
    assert.equal(segments.some((segment) => segment.solarTermBoundary), true);
  }
});

test("true solar time records a corrected birth time based on longitude", () => {
  const urumqi = getFortuneLocationById("cn-urumqi");
  const standard = buildBaziChart({
    profileName: "测试命主",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1992-11-03T00:20",
    birthLocation: urumqi,
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });
  const trueSolar = buildBaziChart({
    profileName: "测试命主",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1992-11-03T00:20",
    birthLocation: urumqi,
    useTrueSolarTime: true,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });

  assert.equal(standard.calculationBasis.timeBasis, "standard");
  assert.equal(trueSolar.calculationBasis.timeBasis, "trueSolar");
  assert.notEqual(
    standard.calculationBasis.effectiveBirthDateTimeLocal,
    trueSolar.calculationBasis.effectiveBirthDateTimeLocal
  );
  assert.equal(trueSolar.calculationBasis.trueSolarOffsetMinutes < -100, true);
  assert.equal(trueSolar.calculationBasis.longitudeOffsetMinutes < -120, true);
  assert.equal(Math.abs(trueSolar.calculationBasis.equationOfTimeMinutes) > 10, true);
});

test("true solar time may cross a DST gap without treating solar wall time as civil time", () => {
  assert.doesNotThrow(() =>
    buildBaziChart({
      method: "bazi",
      profileName: "纽约命主",
      gender: "female",
      birthCalendar: "gregorian",
      birthDateTimeLocal: "2026-03-08T03:30",
      birthLocation: {
        name: "New York",
        longitude: -74.006,
        latitude: 40.7128,
        timezone: "America/New_York",
      },
      useTrueSolarTime: true,
      queryDateTimeLocal: "2026-07-01T12:00",
      modelId: "gpt-4o-mini",
    })
  );
});

test("luck cycle direction follows gender and year stem yin-yang rule", () => {
  const shanghai = getFortuneLocationById("cn-shanghai");
  const male = buildBaziChart({
    profileName: "男命",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: shanghai,
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });
  const female = buildBaziChart({
    profileName: "女命",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: shanghai,
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });

  assert.equal(male.luckCycles[0].direction, "forward");
  assert.equal(female.luckCycles[0].direction, "backward");
  assert.notEqual(male.luckCycles[0].pillar.stemBranch, female.luckCycles[0].pillar.stemBranch);
});

test("validateFortuneInput rejects future birth dates", () => {
  assert.throws(
    () =>
      validateFortuneInput({
        profileName: "未来人",
        gender: "other",
        birthCalendar: "gregorian",
        birthDateTimeLocal: "2999-01-01T00:00",
        birthLocation: getFortuneLocationById("cn-beijing"),
        useTrueSolarTime: false,
        queryDateTimeLocal: "2026-06-10T12:00",
        modelId: "gpt-4o-mini",
      }),
    (error) =>
      error instanceof FortuneValidationError &&
      /出生时间不能晚于测算时间/.test(error.message)
  );
});

test("validateFortuneInput rejects non-binary calculation gender for bazi", () => {
  assert.throws(
    () =>
      validateFortuneInput({
        method: "bazi",
        profileName: "测试命主",
        gender: "other",
        birthCalendar: "gregorian",
        birthDateTimeLocal: "1990-01-01T00:00",
        birthLocation: getFortuneLocationById("cn-beijing"),
        useTrueSolarTime: false,
        queryDateTimeLocal: "2026-06-10T12:00",
        modelId: "gpt-4o-mini",
      }),
    /排盘口径/
  );
});
