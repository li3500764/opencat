import assert from "node:assert/strict";
import test from "node:test";

const {
  normalizeImageGenerationResult,
  mergeToolRenderedContent,
} = await import("./image-generation-utils.ts");

test("normalizes OpenAI-compatible image responses that return a URL", () => {
  const result = normalizeImageGenerationResult({
    data: [
      {
        url: "https://example.com/cat.png",
        revised_prompt: "cute cat",
      },
    ],
  });

  assert.deepEqual(result, {
    url: "https://example.com/cat.png",
    markdown: "![Generated Image](https://example.com/cat.png)",
    revised_prompt: "cute cat",
  });
});

test("normalizes OpenAI-compatible image responses that return b64_json", () => {
  const result = normalizeImageGenerationResult({
    data: [
      {
        b64_json: "QUJDRA==",
      },
    ],
  });

  assert.deepEqual(result, {
    url: "data:image/png;base64,QUJDRA==",
    markdown: "![Generated Image](data:image/png;base64,QUJDRA==)",
    revised_prompt: "",
  });
});

test("merges markdown returned by tool results into the sub-agent reply", () => {
  const merged = mergeToolRenderedContent("", [
    {
      output: {
        success: true,
        data: {
          markdown: "![Generated Image](https://example.com/cat.png)",
        },
      },
    },
  ]);

  assert.equal(merged, "![Generated Image](https://example.com/cat.png)");
});

test("does not duplicate markdown already present in the sub-agent reply", () => {
  const merged = mergeToolRenderedContent(
    "这里是结果\n\n![Generated Image](https://example.com/cat.png)",
    [
      {
        output: {
          success: true,
          data: {
            markdown: "![Generated Image](https://example.com/cat.png)",
          },
        },
      },
    ],
  );

  assert.equal(merged, "这里是结果\n\n![Generated Image](https://example.com/cat.png)");
});
