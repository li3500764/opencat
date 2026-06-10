export interface ImageGenerationTaskSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  details: {
    kind?: string;
    mode?: "text-to-image" | "image-to-image";
    apiKeyId?: string;
    model?: string;
    prompt?: string;
    size?: string;
    quality?: string;
    style?: string;
    sourceImageUrl?: string;
    sourceImageName?: string;
    sourceImageMimeType?: string;
    imageUrl?: string;
    remoteImageUrl?: string;
    revisedPrompt?: string;
    error?: string;
  } | null;
}

type ImageGenerationTaskDetails = NonNullable<ImageGenerationTaskSummary["details"]>;

function parseLogs(logs: unknown): string[] {
  return Array.isArray(logs) ? logs.filter((item): item is string => typeof item === "string") : [];
}

function removeHeavyImagePayload(details: ImageGenerationTaskDetails | null) {
  if (!details) return null;

  const sanitized = { ...details };
  if (sanitized.remoteImageUrl?.startsWith("data:")) {
    delete sanitized.remoteImageUrl;
  }

  return sanitized;
}

function parseDetails(details: string | null | undefined) {
  if (!details) return null;
  try {
    return removeHeavyImagePayload(JSON.parse(details) as ImageGenerationTaskDetails);
  } catch {
    return null;
  }
}

export function serializeImageGenerationTask(task: {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  logs: unknown;
  details: string | null;
}) {
  return {
    id: task.id,
    name: task.name,
    type: task.type,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    logs: parseLogs(task.logs),
    details: parseDetails(task.details),
  } satisfies ImageGenerationTaskSummary;
}
