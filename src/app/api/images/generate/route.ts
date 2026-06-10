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
import { redis } from "@/lib/redis";
import {
  createImageGenerationTask,
  failImageGenerationTask,
  persistReferenceImageAsset,
  updateImageGenerationTaskDetails,
} from "@/lib/images/task-runner";
import { serializeImageGenerationTask } from "@/lib/images/task-serialization";

type SerializableImageTask = Parameters<typeof serializeImageGenerationTask>[0];

export const dynamic = "force-dynamic";

const timedLogThresholdMs = 1000;

function nowMs() {
  return Date.now();
}

function logSlowImageTaskListTimings(timings: Record<string, number>, taskCount: number) {
  if (timings.total < timedLogThresholdMs) return;

  console.warn("[images/generate:GET] slow task list", {
    ...timings,
    taskCount,
  });
}

const generateImageSchema = z.object({
  apiKeyId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  prompt: z.string().trim().min(1).max(8000),
  mode: z.enum(["text-to-image", "image-to-image"]).default("text-to-image"),
  size: z
    .enum(["1024x1024", "1536x1024", "2048x2048", "4096x4096", "1024x1792", "1792x1024"])
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

    try {
      await redis.xadd(
        "opencat:tasks",
        "*",
        "taskId",
        task.id,
        "type",
        "image-generation",
        "userId",
        session.user.id,
        "payload",
        JSON.stringify({
          details:
            mode === "image-to-image" && referenceImage
              ? {
                  mode,
                  sourceImageName: referenceImage.name,
                  sourceImageMimeType: referenceImage.type || "image/png",
                }
              : { mode },
        })
      );
    } catch (queueError) {
      await failImageGenerationTask(
        task.id,
        queueError instanceof Error ? queueError.message : "Failed to enqueue image generation task"
      );
      throw queueError;
    }

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
  const startedAt = nowMs();
  const session = await auth();
  const authFinishedAt = nowMs();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = (await db.$queryRaw`
      SELECT
        bt.id,
        bt.name,
        bt.type,
        bt.status,
        bt.progress,
        bt."createdAt",
        bt."updatedAt",
        bt.logs,
        CASE
          WHEN bt.details IS NULL THEN NULL
          ELSE (bt.details::jsonb - 'remoteImageUrl')::text
        END AS details
      FROM "BackgroundTask" bt
      INNER JOIN "Project" p ON p.id = bt."projectId"
      WHERE bt.type = 'image-generation'
        AND p."userId" = ${session.user.id}
      ORDER BY bt."createdAt" DESC
      LIMIT 30
    `) as SerializableImageTask[];
    const queryFinishedAt = nowMs();

    const serializedTasks = tasks.map(serializeImageGenerationTask);
    const serializedAt = nowMs();
    logSlowImageTaskListTimings(
      {
        auth: authFinishedAt - startedAt,
        query: queryFinishedAt - authFinishedAt,
        serialize: serializedAt - queryFinishedAt,
        total: serializedAt - startedAt,
      },
      serializedTasks.length
    );

    return Response.json(serializedTasks);
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
