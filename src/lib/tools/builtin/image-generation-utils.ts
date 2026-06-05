type ImageGenerationResponseItem = {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
};

type ImageGenerationResponse = {
  data?: ImageGenerationResponseItem[];
};

type ToolResultLike = {
  output?: unknown;
};

function extractMarkdownStrings(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    return value.includes("![") || value.includes("](") ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractMarkdownStrings);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(extractMarkdownStrings);
  }

  return [];
}

export function normalizeImageGenerationResult(resData: ImageGenerationResponse) {
  const firstItem = resData.data?.[0];
  const imageUrl =
    firstItem?.url ||
    (firstItem?.b64_json ? `data:image/png;base64,${firstItem.b64_json}` : undefined);

  if (!imageUrl) {
    return null;
  }

  return {
    url: imageUrl,
    markdown: `![Generated Image](${imageUrl})`,
    revised_prompt: firstItem?.revised_prompt || "",
  };
}

function isSuccessfulToolOutput(output: unknown): output is { success: true; data?: unknown } {
  return (
    typeof output === "object" &&
    output !== null &&
    "success" in output &&
    (output as { success?: unknown }).success === true
  );
}

export function mergeToolRenderedContent(
  responseText: string,
  toolResults: ToolResultLike[] | undefined
) {
  const markdownBlocks = (toolResults || [])
    .flatMap((toolResult) =>
      isSuccessfulToolOutput(toolResult.output)
        ? extractMarkdownStrings(toolResult.output.data)
        : []
    )
    .filter((markdown, index, list) => list.indexOf(markdown) === index)
    .filter((markdown) => !responseText.includes(markdown));

  if (markdownBlocks.length === 0) {
    return responseText;
  }

  return [responseText, ...markdownBlocks]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n");
}
