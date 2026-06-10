import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildTarotChart } = jiti("./tarot.ts");

test("buildTarotChart deterministically draws a three-card spread from a seed", () => {
  const first = buildTarotChart({
    profileName: "测试命主",
    birthDateTimeLocal: "1990-05-17T08:30",
    queryDateTimeLocal: "2026-06-10T12:00",
    question: "当前整体运势如何？",
  });
  const second = buildTarotChart({
    profileName: "测试命主",
    birthDateTimeLocal: "1990-05-17T08:30",
    queryDateTimeLocal: "2026-06-10T12:00",
    question: "当前整体运势如何？",
  });

  assert.deepEqual(second, first);
  assert.equal(first.method, "tarot-deterministic-draw");
  assert.equal(first.spread.id, "past-present-future");
  assert.equal(first.cards.length, 3);
  assert.equal(new Set(first.cards.map((card) => card.card.id)).size, 3);
  assert.equal(first.cards.every((card) => ["upright", "reversed"].includes(card.orientation)), true);
  assert.equal(first.calculationBasis.ruleSet, "opencat-tarot-v1");
  assert.match(first.calculationBasis.seed, /^[0-9a-f]{16}$/);
});

test("buildTarotChart changes draw when query time changes", () => {
  const first = buildTarotChart({
    profileName: "测试命主",
    birthDateTimeLocal: "1990-05-17T08:30",
    queryDateTimeLocal: "2026-06-10T12:00",
    question: "当前整体运势如何？",
  });
  const second = buildTarotChart({
    profileName: "测试命主",
    birthDateTimeLocal: "1990-05-17T08:30",
    queryDateTimeLocal: "2026-06-10T12:01",
    question: "当前整体运势如何？",
  });

  assert.notEqual(
    second.cards.map((card) => `${card.card.id}:${card.orientation}`).join("|"),
    first.cards.map((card) => `${card.card.id}:${card.orientation}`).join("|")
  );
});
