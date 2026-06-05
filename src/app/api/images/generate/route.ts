// ============================================================
// Image Generation API
// ============================================================
// Dedicated image generation endpoint. This intentionally does not use
// Agent tool calling: the UI chooses an API key and model explicitly.
//
// This route now creates a persistent background task, returns immediately,
// and lets the generation continue even if the page refreshes.

import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { isEncryptionConfigError } from "@/lib/crypto";
import { classifyDatabaseError } from "@/server/db/errors";
import {
  createImageGenerationTask,
  persistReferenceImageAsset,
  runImageGenerationTask,
  updateImageGenerationTaskDetails,
} from "@/lib/images/task-runner";
import { serializeImageGenerationTask } from "@/lib/images/task-serialization";

type SerializableImageTask = Parameters<typeof serializeImageGenerationTask>[0];

const backgroundTaskDb = db as typeof db & {
  backgroundTask: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

const generateImageSchema = z.object({
  apiKeyId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  prompt: z.string().trim().min(1).max(8000),
  mode: z.enum(["text-to-image", "image-to-image"]).default("text-to-image"),
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
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        apiKeyId: formData.get("apiKeyId"),
        model: formData.get("model"),
        prompt: formData.get("prompt"),
        mode: formData.get("mode") || "text-to-image",
        size: formData.get("size") || "1024x1024",
        quality: formData.get("quality") || undefined,
        style: formData.get("style") || undefined,
        referenceImage: formData.get("referenceImage"),
      };
    } else {
      body = await req.json();
    }

    const parsed = generateImageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKeyId, model, prompt, mode, size, quality, style } = parsed.data;
    const referenceImage =
      body.referenceImage instanceof File ? body.referenceImage : null;

    if (mode === "image-to-image" && !referenceImage) {
      return Response.json(
        { error: "Reference image is required for image-to-image mode" },
        { status: 400 }
      );
    }

    const key = await db.apiKey.findFirst({
      where: { id: apiKeyId, userId: session.user.id, isActive: true },
      select: { id: true },
    });

    if (!key) {
      return Response.json({ error: "API key not found or inactive" }, { status: 404 });
    }

    const task = (await createImageGenerationTask({
      userId: session.user.id,
      apiKeyId,
      model,
      prompt,
      mode,
      size,
      quality,
      style,
    })) as SerializableImageTask;

    if (mode === "image-to-image" && referenceImage) {
      const sourceImageUrl = await persistReferenceImageAsset(task.id, referenceImage);
      await updateImageGenerationTaskDetails(task.id, {
        mode,
        sourceImageUrl,
        sourceImageName: referenceImage.name,
        sourceImageMimeType: referenceImage.type || "image/png",
      });
    }

    void runImageGenerationTask(task.id, session.user.id);

    return Response.json({
      success: true,
      task: serializeImageGenerationTask(task),
    }, { status: 202 });
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = (await backgroundTaskDb.backgroundTask.findMany({
      where: {
        type: "image-generation",
        project: {
          userId: session.user.id,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    })) as SerializableImageTask[];

    return Response.json(tasks.map(serializeImageGenerationTask));
  } catch (error) {
    const databaseError = classifyDatabaseError(error);
    if (databaseError) {
      return Response.json(
        { error: databaseError.message, code: databaseError.code },
        { status: databaseError.status }
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load image tasks" },
      { status: 500 }
    );
  }
}
