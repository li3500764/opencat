import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildZhouyiTimeChart } = jiti("./zhouyi.ts");

test("buildZhouyiTimeChart deterministically creates a Mei Hua time hexagram", () => {
  const chart = buildZhouyiTimeChart({
    queryDateTimeLocal: "2026-06-10T12:00",
    question: "当前整体运势如何？",
  });

  assert.equal(chart.method, "meihua-time");
  assert.equal(chart.calculationBasis.ruleSet, "opencat-meihua-v1");
  assert.equal(chart.inputs.lunar.year, 2026);
  assert.equal(chart.inputs.lunar.month, 4);
  assert.equal(chart.inputs.lunar.day, 25);
  assert.equal(chart.inputs.hourBranch, "午");
  assert.equal(chart.upperTrigram.name, "震");
  assert.equal(chart.lowerTrigram.name, "离");
  assert.equal(chart.primaryHexagram.name, "雷火丰");
  assert.equal(chart.primaryHexagram.kingWenNumber, 55);
  assert.equal(chart.movingLine, 1);
  assert.equal(chart.changedHexagram.name, "雷山小过");
  assert.equal(chart.mutualHexagram.name, "泽风大过");
  assert.deepEqual(chart.primaryHexagram.lines, [true, false, true, true, false, false]);
});

test("buildZhouyiTimeChart keeps moving line inside first through sixth line", () => {
  for (const hour of ["00", "03", "06", "09", "12", "15", "18", "21", "23"]) {
    const chart = buildZhouyiTimeChart({
      queryDateTimeLocal: `2026-06-10T${hour}:30`,
      question: "",
    });
    assert.equal(chart.movingLine >= 1, true);
    assert.equal(chart.movingLine <= 6, true);
    assert.equal(chart.changedHexagram.lines.length, 6);
    assert.equal(chart.mutualHexagram.lines.length, 6);
  }
});
