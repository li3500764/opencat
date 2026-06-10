import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const {
  CONSULT_RECENT_MESSAGE_LIMIT,
  buildFortuneConsultPrompt,
  buildFortuneConsultSystemPrompt,
  selectMessagesForConsultCompression,
  selectRecentConsultMessages,
  shouldCompressConsultHistory,
} = jiti("./consult.ts");

test("fortune consult prompt is scoped to one method and chart", () => {
  const prompt = buildFortuneConsultPrompt({
    method: "bazi",
    chart: { method: "bazi", chart: { pillars: { day: { stemBranch: "辛巳" } } } },
    initialInterpretation: "日主辛金。",
    summary: "用户关心事业。",
    recentMessages: [{ role: "user", content: "事业怎么看？" }],
    question: "明年适合换工作吗？",
  });
  const system = buildFortuneConsultSystemPrompt("bazi");

  assert.match(system, /四柱八字咨询大师/);
  assert.match(system, /不得跨体系混合解读/);
  assert.match(prompt, /辛巳/);
  assert.match(prompt, /明年适合换工作吗/);
});

test("fortune consult history keeps recent messages and compresses older messages", () => {
  const messages = Array.from({ length: 24 }, (_, index) => ({
    tokenCount: 100,
    content: `message ${index}`,
  }));

  assert.equal(shouldCompressConsultHistory(messages), true);
  assert.equal(selectRecentConsultMessages(messages).length, CONSULT_RECENT_MESSAGE_LIMIT);
  assert.deepEqual(
    selectMessagesForConsultCompression(messages).map((message) => message.content),
    messages.slice(0, 16).map((message) => message.content)
  );
});

test("fortune consult history compresses when estimated tokens are high", () => {
  const messages = Array.from({ length: 4 }, () => ({ tokenCount: 1600 }));

  assert.equal(shouldCompressConsultHistory(messages), true);
});
