import assert from "node:assert/strict";
import test from "node:test";

const { createModel } = await import("./registry.ts");

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
