import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildFortuneSystemPrompt, buildFortuneUserPrompt } = jiti("./reader.ts");

const input = {
  profileName: "李波",
  gender: "male",
  birthCalendar: "gregorian",
  birthDateTimeLocal: "2000-01-24T04:05",
  birthLocation: {
    name: "台州市三门县花桥镇",
    longitude: 121.4811,
    latitude: 28.9064,
    timezone: "Asia/Shanghai",
  },
  useTrueSolarTime: true,
  queryDateTimeLocal: "2026-06-10T17:13",
  modelId: "gpt-5.5",
};

test("buildFortuneUserPrompt keeps bazi reading independent", () => {
  const prompt = buildFortuneUserPrompt(input, "bazi", {
    pillars: {
      day: { stemBranch: "辛巳" },
    },
    calculationBasis: {
      timeBasis: "trueSolar",
      queryDateTimeLocal: "2026-06-10T17:13",
    },
  });

  assert.match(prompt, /四柱八字/);
  assert.doesNotMatch(prompt, /紫微斗数提示/);
  assert.doesNotMatch(prompt, /塔罗三张牌/);
  assert.doesNotMatch(prompt, /周易时间卦提示/);
});

test("buildFortuneUserPrompt keeps tarot reading independent", () => {
  const prompt = buildFortuneUserPrompt(input, "tarot", {
    method: "tarot-deterministic-draw",
    cards: [{ card: { name: "太阳" }, orientation: "upright" }],
    calculationBasis: {
      queryDateTimeLocal: "2026-06-10T17:13",
    },
  });

  assert.match(prompt, /塔罗牌阵/);
  assert.doesNotMatch(prompt, /日主与五行/);
  assert.doesNotMatch(prompt, /十神结构/);
  assert.doesNotMatch(prompt, /紫微斗数提示/);
  assert.doesNotMatch(prompt, /周易时间卦提示/);
});

test("fortune system prompt forbids pseudo-statistical certainty", () => {
  const prompt = buildFortuneSystemPrompt();
  assert.match(prompt, /不得输出单点百分比/);
  assert.match(prompt, /低、中、高/);
  assert.match(prompt, /现实统计概率/);
});
