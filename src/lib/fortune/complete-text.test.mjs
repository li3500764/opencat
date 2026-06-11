import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildFortuneContinuationPrompt, shouldContinueFortuneText } = jiti("./complete-text.ts");

test("shouldContinueFortuneText only continues when provider stopped by length", () => {
  assert.equal(shouldContinueFortuneText("length"), true);
  assert.equal(shouldContinueFortuneText("stop"), false);
  assert.equal(shouldContinueFortuneText("content-filter"), false);
  assert.equal(shouldContinueFortuneText("error"), false);
});

test("buildFortuneContinuationPrompt asks the model to continue without repeating", () => {
  const prompt = buildFortuneContinuationPrompt({
    originalPrompt: "原始问题：事业怎么看？",
    currentText: "前文已经说到 2028 年适合发挥食神，",
  });

  assert.match(prompt, /原始问题/);
  assert.match(prompt, /被长度限制截断/);
  assert.match(prompt, /不要重复/);
  assert.match(prompt, /继续完成回答/);
});
