import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { extractFortuneCharts } = jiti("./normalize.ts");

test("extractFortuneCharts reads legacy bazi-only chart records", () => {
  const legacyChart = {
    profileName: "旧格式",
    pillars: {
      day: { stemBranch: "壬午" },
    },
  };

  const extracted = extractFortuneCharts(legacyChart);

  assert.equal(extracted.bazi, legacyChart);
  assert.equal(extracted.zhouyi, undefined);
});

test("extractFortuneCharts reads composite fortune chart records", () => {
  const bazi = {
    profileName: "新格式",
    pillars: {
      day: { stemBranch: "壬午" },
    },
  };
  const zhouyi = {
    method: "meihua-time",
    primaryHexagram: { name: "雷火丰" },
  };
  const tarot = {
    method: "tarot-deterministic-draw",
    cards: [{ card: { name: "太阳" } }],
  };
  const ziwei = {
    method: "ziwei-astrolabe",
    palaces: [{ name: "命宫" }],
  };

  const extracted = extractFortuneCharts({ bazi, zhouyi, ziwei, tarot });

  assert.equal(extracted.bazi, bazi);
  assert.equal(extracted.zhouyi, zhouyi);
  assert.equal(extracted.ziwei, ziwei);
  assert.equal(extracted.tarot, tarot);
});
