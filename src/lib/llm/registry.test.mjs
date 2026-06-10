import assert from "node:assert/strict";
import test from "node:test";

const { createModel, normalizeOpenAIBaseUrl } = await import("./registry.ts");

test("createModel uses OpenAI Responses API when the key format requests it", () => {
  const model = createModel("gpt-5.5", "test-key", {
    format: "openai-responses",
  });

  assert.equal(model.config.provider, "openai.responses");
});

test("createModel keeps OpenAI-compatible providers on Chat Completions by default", () => {
  const model = createModel("deepseek-chat", "test-key", {
    format: "openai",
  });

  assert.equal(model.config.provider, "openai.chat");
});

test("normalizeOpenAIBaseUrl appends v1 for OpenAI-compatible gateway roots", () => {
  assert.equal(normalizeOpenAIBaseUrl("https://api.deepseek.com"), "https://api.deepseek.com/v1");
  assert.equal(normalizeOpenAIBaseUrl("http://s2a.v-yg.com/"), "http://s2a.v-yg.com/v1");
  assert.equal(normalizeOpenAIBaseUrl("https://example.com/v1"), "https://example.com/v1");
});
