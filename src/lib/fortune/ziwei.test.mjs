import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildZiweiChart } = jiti("./ziwei.ts");
const { getFortuneLocationById } = jiti("./chart.ts");

test("buildZiweiChart returns a stable zi wei astrolabe shape", () => {
  const chart = buildZiweiChart({
    profileName: "测试命主",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: getFortuneLocationById("cn-beijing"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });

  assert.equal(chart.method, "ziwei-astrolabe");
  assert.equal(chart.profileName, "测试命主");
  assert.equal(chart.gender, "male");
  assert.equal(chart.solarDate, "1990-5-17");
  assert.equal(chart.lunarDate, "一九九〇年四月廿三");
  assert.equal(chart.chineseDate, "庚午 辛巳 壬午 甲辰");
  assert.equal(chart.timeIndex, 4);
  assert.equal(chart.time, "辰时");
  assert.equal(chart.timeRange, "07:00~09:00");
  assert.equal(chart.soul, "巨门");
  assert.equal(chart.body, "火星");
  assert.equal(chart.earthlyBranchOfSoulPalace, "丑");
  assert.equal(chart.earthlyBranchOfBodyPalace, "酉");
  assert.equal(chart.fiveElementsClass, "火六局");
  assert.equal(chart.palaces.length, 12);

  const soulPalace = chart.palaces.find((palace) => palace.name === "命宫");
  assert.equal(soulPalace?.earthlyBranch, "丑");
  assert.equal(soulPalace?.majorStars.map((star) => star.name).join("、"), "太阳、太阴");
  assert.equal(soulPalace?.minorStars.some((star) => star.name === "天魁"), true);

  const ziweiPalace = chart.palaces.find((palace) =>
    palace.majorStars.some((star) => star.name === "紫微")
  );
  assert.equal(ziweiPalace?.name, "田宅");
  assert.equal(chart.calculationBasis.ruleSet, "opencat-ziwei-v1");
  assert.equal(chart.calculationBasis.library, "iztro");
  assert.equal(chart.calculationBasis.libraryVersion, "2.5.8");
});

test("buildZiweiChart records true solar time correction when enabled", () => {
  const standard = buildZiweiChart({
    profileName: "测试命主",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1992-11-03T00:20",
    birthLocation: getFortuneLocationById("cn-urumqi"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });
  const trueSolar = buildZiweiChart({
    profileName: "测试命主",
    gender: "female",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1992-11-03T00:20",
    birthLocation: getFortuneLocationById("cn-urumqi"),
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
});
