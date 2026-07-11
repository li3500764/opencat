import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildDynamicConsultContext, parseDynamicTargetRange } = jiti("./dynamic.ts");
const { buildBaziChart, getFortuneLocationById } = jiti("./chart.ts");
const { buildZiweiChart } = jiti("./ziwei.ts");

test("parseDynamicTargetRange resolves an explicit year and month list", () => {
  const result = parseDynamicTargetRange(
    "请按2026年7、8、9、10、11、12月分析裁员风险",
    "2026-06-10T12:00",
    "Asia/Shanghai"
  );

  assert.equal(result.status, "resolved");
  assert.deepEqual(result.requestedMonths, [
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
  ]);
});

test("parseDynamicTargetRange anchors relative years to the reading query time", () => {
  const nextYear = parseDynamicTargetRange("明年事业如何", "2026-06-10T12:00", "Asia/Shanghai");
  const future = parseDynamicTargetRange("未来三年事业趋势", "2026-06-10T12:00", "Asia/Shanghai");

  assert.equal(nextYear.status, "resolved");
  assert.equal(nextYear.range.startLocalDateTime, "2027-01-01T00:00");
  assert.equal(nextYear.requestedMonths.length, 12);
  assert.equal(future.status, "resolved");
  assert.equal(future.requestedMonths.length, 36);
});

test("parseDynamicTargetRange requests clarification for vague or excessive ranges", () => {
  const vague = parseDynamicTargetRange("哪几个月风险最大", "2026-06-10T12:00", "Asia/Shanghai");
  const excessive = parseDynamicTargetRange("未来十一年趋势", "2026-06-10T12:00", "Asia/Shanghai");

  assert.equal(vague.status, "clarification");
  assert.equal(excessive.status, "clarification");
  assert.match(excessive.message, /10 年/);
});

test("buildDynamicConsultContext filters a bazi chart to requested Gregorian months", () => {
  const chart = buildBaziChart({
    method: "bazi",
    profileName: "测试命主",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: getFortuneLocationById("cn-beijing"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });
  const result = buildDynamicConsultContext({
    method: "bazi",
    chart,
    question: "2026年7至12月裁员风险",
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.dynamicContexts.length, 1);
  assert.equal(result.dynamicContexts[0].monthSegments.length, 12);
  assert.equal(result.dynamicContexts[0].monthSegments[0].gregorianMonth, "2026-07");
});

test("buildDynamicConsultContext does not silently recalculate a legacy chart", () => {
  const result = buildDynamicConsultContext({
    method: "bazi",
    chart: {
      pillars: { day: { stem: "辛" } },
      calculationBasis: { ruleSet: "opencat-ziping-v1", queryDateTimeLocal: "2026-06-10T12:00", timezone: "Asia/Shanghai" },
    },
    question: "2026年7至12月风险",
  });

  assert.equal(result.status, "clarification");
  assert.match(result.message, /旧版命盘/);
});

test("ziwei Gregorian months include every overlapping flow-month segment", () => {
  const chart = buildZiweiChart({
    method: "ziwei",
    profileName: "测试命主",
    gender: "male",
    birthCalendar: "gregorian",
    birthDateTimeLocal: "1990-05-17T08:30",
    birthLocation: getFortuneLocationById("cn-beijing"),
    useTrueSolarTime: false,
    queryDateTimeLocal: "2026-06-10T12:00",
    modelId: "gpt-4o-mini",
  });
  const result = buildDynamicConsultContext({
    method: "ziwei",
    chart,
    question: "2026年7月事业风险",
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.dynamicContexts.length, 2);
  assert.equal(result.dynamicContexts[0].targetRange.startLocalDateTime, "2026-07-01T00:00");
  assert.equal(
    result.dynamicContexts[0].targetRange.endLocalDateTime,
    result.dynamicContexts[1].targetRange.startLocalDateTime
  );
  assert.equal(result.dynamicContexts[1].targetRange.endLocalDateTime, "2026-08-01T00:00");
});
