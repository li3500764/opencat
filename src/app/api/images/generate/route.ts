// ============================================================
// Image Generation API
// ============================================================
// Dedicated image generation endpoint. This intentionally does not use
// Agent tool calling: the UI chooses an API key and model explicitly.

import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt, isEncryptionConfigError } from "@/lib/crypto";
import { classifyDatabaseError } from "@/server/db/errors";
import { normalizeImageGenerationResult } from "@/lib/tools/builtin/image-generation-utils";

const generateImageSchema = z.object({
  apiKeyId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  prompt: z.string().trim().min(1).max(8000),
  size: z
    .enum(["1024x1024", "2048x2048", "4096x4096", "1024x1792", "1792x1024"])
    .default("1024x1024"),
  quality: z.string().trim().optional(),
  style: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = generateImageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKeyId, model, prompt, size, quality, style } = parsed.data;
    const key = await db.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!key) {
      return Response.json({ error: "API key not found or inactive" }, { status: 404 });
    }

    const apiKey = decrypt(key.encryptedKey, key.iv);
    const cleanBaseUrl = (key.baseUrl || "https://api.openai.com").replace(/\/$/, "");
    const apiBase =
      cleanBaseUrl.endsWith("/v1") || cleanBaseUrl.includes("/v1/")
        ? cleanBaseUrl
        : `${cleanBaseUrl}/v1`;

    const requestBody: Record<string, string | number> = {
      model,
      prompt,
      size,
      n: 1,
    };

    if (quality) requestBody.quality = quality;
    if (style) requestBody.style = style;

    const response = await fetch(`${apiBase}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        responseData?.error?.message ||
        responseData?.message ||
        response.statusText ||
        "Image generation failed";
      return Response.json({ error: message, raw: responseData }, { status: response.status });
    }

    const normalized = normalizeImageGenerationResult(responseData);
    if (!normalized) {
      return Response.json(
        { error: "Image provider returned no usable image data", raw: responseData },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      image: normalized,
      request: {
        apiKeyId,
        model,
        size,
      },
      raw: responseData,
    });
  } catch (error) {
    if (isEncryptionConfigError(error)) {
      return Response.json(
        {
          error:
            "Server encryption is not configured. Set ENCRYPTION_KEY to a 64-character hex string, then restart the app.",
          code: "ENCRYPTION_CONFIG_ERROR",
        },
        { status: 503 }
      );
    }

    const databaseError = classifyDatabaseError(error);
    if (databaseError) {
      return Response.json(
        { error: databaseError.message, code: databaseError.code },
        { status: databaseError.status }
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
