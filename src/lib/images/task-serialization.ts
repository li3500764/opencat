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
    apiKeyId?: string;
    model?: string;
    prompt?: string;
    size?: string;
    quality?: string;
    style?: string;
    imageUrl?: string;
    remoteImageUrl?: string;
    revisedPrompt?: string;
    error?: string;
  } | null;
}

function parseLogs(logs: unknown): string[] {
  return Array.isArray(logs) ? logs.filter((item): item is string => typeof item === "string") : [];
}

function parseDetails(details: string | null | undefined) {
  if (!details) return null;
  try {
    return JSON.parse(details) as ImageGenerationTaskSummary["details"];
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
