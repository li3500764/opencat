import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
import { redis } from "@/lib/redis";
import { normalizeImageGenerationResult } from "@/lib/tools/builtin/image-generation-utils";

type CreateImageTaskInput = {
  userId: string;
  apiKeyId: string;
  model: string;
  prompt: string;
  size: "1024x1024" | "2048x2048" | "4096x4096" | "1024x1792" | "1792x1024";
  quality?: string;
  style?: string;
};

type ImageTaskDetails = {
  kind: "image-generation";
  apiKeyId: string;
  model: string;
  prompt: string;
  size: string;
  quality?: string;
  style?: string;
  imageUrl?: string;
  remoteImageUrl?: string;
  revisedPrompt?: string;
  error?: string;
};

type BackgroundTaskRecord = {
  id: string;
  details: string | null;
  logs: unknown;
  project: { userId: string };
};

const backgroundTaskDb = db as typeof db & {
  backgroundTask: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};

function parseLogs(logs: unknown): string[] {
  return Array.isArray(logs) ? logs.filter((item): item is string => typeof item === "string") : [];
}

function parseDetails(details: string | null | undefined): ImageTaskDetails | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as ImageTaskDetails;
  } catch {
    return null;
  }
}

async function updateTask(
  taskId: string,
  updates: {
    status?: string;
    progress?: number;
    log?: string;
    details?: ImageTaskDetails;
  }
) {
  const current = (await backgroundTaskDb.backgroundTask.findUnique({
    where: { id: taskId },
    select: { logs: true, details: true, project: { select: { userId: true } } },
  })) as Pick<BackgroundTaskRecord, "details" | "logs" | "project"> | null;

  if (!current) return;

  const nextLogs = updates.log ? [...parseLogs(current.logs), updates.log] : parseLogs(current.logs);
  const nextDetails = updates.details ?? parseDetails(current.details) ?? undefined;

  await backgroundTaskDb.backgroundTask.update({
    where: { id: taskId },
    data: {
      status: updates.status,
      progress: updates.progress,
      logs: nextLogs,
      details: nextDetails ? JSON.stringify(nextDetails) : undefined,
    },
  });

  try {
    await redis.publish(
      "opencat:task-progress",
      JSON.stringify({
        taskId,
        userId: current.project.userId,
        status: updates.status,
        progress: updates.progress,
        log: updates.log,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Failed to publish image task progress", error);
  }
}

async function ensureDefaultProject(userId: string) {
  let project = await db.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!project) {
    project = await db.project.create({
      data: {
        userId,
        name: "Default",
        description: "Default project",
        defaultModel: "gpt-5.4-mini",
      },
      select: { id: true },
    });
  }

  return project;
}

async function persistImageAsset(taskId: string, imageUrl: string) {
  const taskDir = path.join(process.cwd(), "public", "generated-images");
  await mkdir(taskDir, { recursive: true });

  let bytes: Uint8Array;
  let extension = "png";

  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported image data format");
    }

    const mimeType = match[1];
    const base64Payload = match[2];
    bytes = Uint8Array.from(Buffer.from(base64Payload, "base64"));

    if (mimeType === "image/jpeg") extension = "jpg";
    if (mimeType === "image/webp") extension = "webp";
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const arrayBuffer = await response.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);

    if (contentType.includes("jpeg")) extension = "jpg";
    if (contentType.includes("webp")) extension = "webp";
  }

  const fileName = `${taskId}.${extension}`;
  const filePath = path.join(taskDir, fileName);
  await writeFile(filePath, bytes);

  return `/generated-images/${fileName}`;
}

export async function createImageGenerationTask(input: CreateImageTaskInput) {
  const project = await ensureDefaultProject(input.userId);
  const details: ImageTaskDetails = {
    kind: "image-generation",
    apiKeyId: input.apiKeyId,
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    style: input.style,
  };

  return backgroundTaskDb.backgroundTask.create({
    data: {
      projectId: project.id,
      name: `Image generation: ${input.model}`,
      type: "image-generation",
      status: "pending",
      progress: 0,
      details: JSON.stringify(details),
      logs: ["[SYSTEM] Image generation task created."],
    },
  });
}

export async function runImageGenerationTask(taskId: string, userId: string) {
  const task = (await backgroundTaskDb.backgroundTask.findUnique({
    where: { id: taskId },
    include: { project: { select: { userId: true } } },
  })) as BackgroundTaskRecord | null;

  if (!task || task.project.userId !== userId) {
    return;
  }

  const details = parseDetails(task.details);
  if (!details) {
    await updateTask(taskId, {
      status: "failed",
      progress: 100,
      log: "[ERROR] Task payload is invalid.",
      details: { kind: "image-generation", apiKeyId: "", model: "", prompt: "", size: "", error: "Task payload is invalid." },
    });
    return;
  }

  try {
    await updateTask(taskId, {
      status: "running",
      progress: 10,
      log: "[SYSTEM] Starting image generation request.",
      details,
    });

    const key = await db.apiKey.findFirst({
      where: {
        id: details.apiKeyId,
        userId,
        isActive: true,
      },
    });

    if (!key) {
      throw new Error("API key not found or inactive");
    }

    const apiKey = decrypt(key.encryptedKey, key.iv);
    const cleanBaseUrl = (key.baseUrl || "https://api.openai.com").replace(/\/$/, "");
    const apiBase =
      cleanBaseUrl.endsWith("/v1") || cleanBaseUrl.includes("/v1/")
        ? cleanBaseUrl
        : `${cleanBaseUrl}/v1`;

    const requestBody: Record<string, string | number> = {
      model: details.model,
      prompt: details.prompt,
      size: details.size,
      n: 1,
    };

    if (details.quality) requestBody.quality = details.quality;
    if (details.style) requestBody.style = details.style;

    await updateTask(taskId, {
      progress: 30,
      log: "[SYSTEM] Image provider request sent.",
      details,
    });

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
        (responseData as { error?: { message?: string }; message?: string })?.error?.message ||
        (responseData as { message?: string })?.message ||
        response.statusText ||
        "Image generation failed";
      throw new Error(message);
    }

    await updateTask(taskId, {
      progress: 70,
      log: "[SYSTEM] Image provider returned a result. Saving asset...",
      details,
    });

    const normalized = normalizeImageGenerationResult(responseData);
    if (!normalized) {
      throw new Error("Image provider returned no usable image data");
    }

    const persistedImageUrl = await persistImageAsset(taskId, normalized.url);
    const completedDetails: ImageTaskDetails = {
      ...details,
      imageUrl: persistedImageUrl,
      remoteImageUrl: normalized.url,
      revisedPrompt: normalized.revised_prompt || undefined,
    };

    await updateTask(taskId, {
      status: "completed",
      progress: 100,
      log: "[SUCCESS] Image generated and saved.",
      details: completedDetails,
    });
  } catch (error) {
    await updateTask(taskId, {
      status: "failed",
      progress: 100,
      log: `[ERROR] ${error instanceof Error ? error.message : "Image generation failed"}`,
      details: {
        ...details,
        error: error instanceof Error ? error.message : "Image generation failed",
      },
    });
  }
}
