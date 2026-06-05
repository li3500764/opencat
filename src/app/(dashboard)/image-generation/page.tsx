"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  ImagePlus,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ApiKeyItem {
  id: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  models: { id: string; name: string }[];
}

interface ImageGenerationTask {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  details: {
    mode?: "text-to-image" | "image-to-image";
    apiKeyId?: string;
    model?: string;
    prompt?: string;
    size?: string;
    quality?: string;
    style?: string;
    sourceImageUrl?: string;
    sourceImageName?: string;
    imageUrl?: string;
    revisedPrompt?: string;
    error?: string;
  } | null;
}

const IMAGE_KEYWORDS = ["image", "dall", "flux", "midjourney", "mj", "sd", "stable-diffusion"];
const SIZES = [
  { value: "1024x1024", label: "1K", hint: "1024" },
  { value: "2048x2048", label: "2K", hint: "2048" },
  { value: "4096x4096", label: "4K", hint: "4096" },
  { value: "1024x1792", label: "9:16", hint: "Portrait" },
  { value: "1792x1024", label: "16:9", hint: "Wide" },
] as const;

function isImageModel(modelId: string) {
  const value = modelId.toLowerCase();
  return IMAGE_KEYWORDS.some((keyword) => value.includes(keyword));
}

function pickInitialKey(keys: ApiKeyItem[]) {
  return (
    keys.find((key) => key.models?.some((model) => isImageModel(model.id))) ||
    keys.find((key) => key.isActive) ||
    keys[0]
  );
}

function formatTaskStatus(task: ImageGenerationTask, t: ReturnType<typeof useTranslation>["t"]) {
  if (task.status === "completed") return t("imageGeneration.completed");
  if (task.status === "failed") return t("imageGeneration.failed");
  if (task.status === "running") return t("imageGeneration.running");
  return t("imageGeneration.pending");
}

export default function ImageGenerationPage() {
  const { t, locale } = useTranslation();
  const defaultPrompt = t("imageGeneration.defaultPrompt");
  const failedToLoadKeysText = t("imageGeneration.failedToLoadKeys");
  const failedToLoadTasksText = t("imageGeneration.failedToLoadTasks");
  const createFailedText = t("imageGeneration.createFailed");
  const previousDefaultPromptRef = useRef(defaultPrompt);
  const selectedKeyIdRef = useRef("");
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [tasks, setTasks] = useState<ImageGenerationTask[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">("text-to-image");
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("1024x1024");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [quality, setQuality] = useState("");
  const [style, setStyle] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKey = useMemo(
    () => keys.find((key) => key.id === selectedKeyId) || null,
    [keys, selectedKeyId]
  );

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || tasks[0] || null,
    [tasks, selectedTaskId]
  );

  const models = selectedKey?.models || [];
  const hasActiveTask = tasks.some((task) => task.status === "pending" || task.status === "running");

  useEffect(() => {
    selectedKeyIdRef.current = selectedKeyId;
  }, [selectedKeyId]);

  const fetchKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error(failedToLoadKeysText);
      const data = (await res.json()) as ApiKeyItem[];
      setKeys(data);
      const nextSelectedKeyId =
        (selectedKeyIdRef.current &&
        data.some((key) => key.id === selectedKeyIdRef.current)
          ? selectedKeyIdRef.current
          : pickInitialKey(data)?.id) || "";
      setSelectedKeyId((currentKeyId) => {
        if (currentKeyId && data.some((key) => key.id === currentKeyId)) {
          return currentKeyId;
        }
        return nextSelectedKeyId;
      });
      setSelectedModel((currentModelId) => {
        const currentKey =
          data.find((key) => key.id === nextSelectedKeyId) || null;
        if (!currentKey) return "";
        if (currentModelId && currentKey.models.some((model) => model.id === currentModelId)) {
          return currentModelId;
        }
        return (
          currentKey.models.find((model) => isImageModel(model.id))?.id ||
          currentKey.models[0]?.id ||
          ""
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : failedToLoadKeysText);
    } finally {
      setIsLoadingKeys(false);
    }
  }, [failedToLoadKeysText]);

  const fetchTasks = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingTasks(true);
    }

    try {
      const res = await fetch("/api/images/generate", { cache: "no-store" });
      if (!res.ok) throw new Error(failedToLoadTasksText);
      const data = (await res.json()) as ImageGenerationTask[];
      setTasks(data);
      setSelectedTaskId((current) => {
        if (current && data.some((task) => task.id === current)) {
          return current;
        }
        return data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : failedToLoadTasksText);
    } finally {
      if (!options?.silent) {
        setIsLoadingTasks(false);
      }
    }
  }, [failedToLoadTasksText]);

  useEffect(() => {
    void fetchKeys();
    void fetchTasks();
  }, [fetchKeys, fetchTasks, locale]);

  useEffect(() => {
    setPrompt((current) =>
      current === previousDefaultPromptRef.current ? defaultPrompt : current
    );
    previousDefaultPromptRef.current = defaultPrompt;
  }, [defaultPrompt]);

  useEffect(() => {
    if (!referenceImage) {
      setReferencePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(referenceImage);
    setReferencePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [referenceImage]);

  useEffect(() => {
    if (!selectedKey) return;
    const modelStillExists = selectedKey.models.some((model) => model.id === selectedModel);
    if (modelStillExists) return;

    const nextModel =
      selectedKey.models.find((model) => isImageModel(model.id)) ||
      selectedKey.models[0];
    setSelectedModel(nextModel?.id || "");
  }, [selectedKey, selectedModel]);

  useEffect(() => {
    if (!hasActiveTask) return;

    const timer = window.setInterval(() => {
      void fetchTasks({ silent: true });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [fetchTasks, hasActiveTask]);

  const handleKeyChange = (keyId: string) => {
    const nextKey = keys.find((key) => key.id === keyId);
    setSelectedKeyId(keyId);
    const nextModel =
      nextKey?.models.find((model) => isImageModel(model.id)) ||
      nextKey?.models[0];
    setSelectedModel(nextModel?.id || "");
  };

  const handleGenerate = async () => {
    if (!selectedKeyId || !selectedModel || !prompt.trim()) return;
    if (mode === "image-to-image" && !referenceImage) {
      setError(t("imageGeneration.sourceImageRequired"));
      return;
    }

    setIsCreatingTask(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("apiKeyId", selectedKeyId);
      formData.append("model", selectedModel);
      formData.append("prompt", prompt);
      formData.append("mode", mode);
      formData.append("size", size);
      if (quality.trim()) formData.append("quality", quality.trim());
      if (style.trim()) formData.append("style", style.trim());
      if (referenceImage) formData.append("referenceImage", referenceImage);

      const res = await fetch("/api/images/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || createFailedText);
      }

      const createdTask = data.task as ImageGenerationTask | undefined;
      if (createdTask) {
        setSelectedTaskId(createdTask.id);
      }
      await fetchTasks({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : createFailedText);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const canGenerate = Boolean(
    selectedKeyId &&
      selectedModel &&
      prompt.trim() &&
      !isCreatingTask &&
      (mode === "text-to-image" || referenceImage)
  );

  return (
    <div className="flex h-full overflow-y-auto bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t("imageGeneration.badge")}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("imageGeneration.title")}
            </h1>
            <p className="text-sm leading-6 text-muted">{t("imageGeneration.subtitle")}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("imageGeneration.formTitle")}
                </h2>
                <p className="text-xs text-muted">{t("imageGeneration.formSubtitle")}</p>
              </div>
              <button
                onClick={() => void fetchKeys()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                title={t("imageGeneration.refreshKeys")}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingKeys ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted">{t("imageGeneration.modeLabel")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("text-to-image")}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      mode === "text-to-image"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    {t("imageGeneration.modeTextToImage")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("image-to-image")}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      mode === "image-to-image"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    {t("imageGeneration.modeImageToImage")}
                  </button>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">{t("imageGeneration.keyLabel")}</span>
                <select
                  value={selectedKeyId}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">{t("imageGeneration.keyPlaceholder")}</option>
                  {keys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label} {key.baseUrl ? `- ${key.baseUrl}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">{t("imageGeneration.modelLabel")}</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                  disabled={!selectedKey}
                >
                  <option value="">{t("imageGeneration.modelPlaceholder")}</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted">{t("imageGeneration.sizeLabel")}</span>
                <div className="grid grid-cols-5 gap-2">
                  {SIZES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSize(item.value)}
                      className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                        size === item.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-background text-muted hover:text-foreground"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{item.label}</span>
                      <span className="block text-[10px] opacity-70">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">{t("imageGeneration.promptLabel")}</span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-44 w-full resize-none rounded-lg border border-border bg-input-bg px-3 py-3 text-sm leading-6 outline-none focus:border-accent"
                  placeholder={t("imageGeneration.promptPlaceholder")}
                />
              </label>

              {mode === "image-to-image" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-medium text-muted">
                        {t("imageGeneration.referenceImageLabel")}
                      </span>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {t("imageGeneration.referenceImageHint")}
                      </p>
                    </div>
                    {referenceImage && (
                      <button
                        type="button"
                        onClick={() => setReferenceImage(null)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        {t("imageGeneration.clearReferenceImage")}
                      </button>
                    )}
                  </div>

                  <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-center transition-colors hover:border-accent/40">
                    {referencePreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={referencePreviewUrl}
                        alt={t("imageGeneration.referenceImageLabel")}
                        className="h-36 w-full rounded-lg object-contain"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <ImagePlus className="h-7 w-7" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {referenceImage
                          ? referenceImage.name
                          : t("imageGeneration.referenceImagePlaceholder")}
                      </p>
                      <p className="text-xs text-muted">
                        {referenceImage
                          ? t("imageGeneration.replaceReferenceImage")
                          : t("imageGeneration.referenceImageHint")}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setReferenceImage(file);
                      }}
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">{t("imageGeneration.qualityLabel")}</span>
                  <input
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                    placeholder={t("imageGeneration.qualityPlaceholder")}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">{t("imageGeneration.styleLabel")}</span>
                  <input
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                    placeholder={t("imageGeneration.stylePlaceholder")}
                  />
                </label>
              </div>

              <div className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-xs leading-5 text-muted">
                {t("imageGeneration.queueTip")}
              </div>

              {error && (
                <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <button
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCreatingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {isCreatingTask ? t("imageGeneration.creatingTask") : t("imageGeneration.createTask")}
              </button>
            </div>
          </div>
        </section>

        <section className="grid min-h-[720px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col rounded-xl border border-border bg-background-secondary p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("imageGeneration.previewTitle")}
                </h2>
                <p className="text-xs text-muted">{t("imageGeneration.previewSubtitle")}</p>
              </div>
              {selectedTask?.details?.imageUrl && (
                <a
                  href={selectedTask.details.imageUrl}
                  download={`opencat-image-${selectedTask.id}.png`}
                  className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("imageGeneration.download")}
                </a>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card p-4">
              {isLoadingTasks ? (
                <div className="flex flex-col items-center gap-3 text-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                  <p className="text-sm">{t("common.loading")}</p>
                </div>
              ) : selectedTask?.details?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedTask.details.imageUrl}
                  alt={t("imageGeneration.latestResult")}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
                />
              ) : selectedTask ? (
                <div className="flex flex-col items-center gap-3 text-center text-muted">
                  {selectedTask.status === "failed" ? (
                    <XCircle className="h-10 w-10 text-danger" />
                  ) : (
                    <Loader2 className="h-10 w-10 animate-spin text-accent" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedTask.status === "failed"
                        ? t("imageGeneration.failed")
                        : t("imageGeneration.generating")}
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      {t("imageGeneration.progressLabel")}: {selectedTask.progress}%
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-muted">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("imageGeneration.emptyTitle")}</p>
                    <p className="mt-1 max-w-sm text-xs leading-5">{t("imageGeneration.emptyDesc")}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedTask && (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {selectedTask.details?.sourceImageUrl && (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="mb-2 text-xs font-semibold text-muted">
                      {t("imageGeneration.sourceImage")}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedTask.details.sourceImageUrl}
                      alt={t("imageGeneration.sourceImage")}
                      className="h-40 w-full rounded-lg object-contain"
                    />
                  </div>
                )}

                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold text-muted">
                    {t("imageGeneration.originalPrompt")}
                  </p>
                  <p className="text-xs leading-5 text-foreground">
                    {selectedTask.details?.prompt || "-"}
                  </p>
                </div>

                {selectedTask.details?.revisedPrompt && (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="mb-2 text-xs font-semibold text-muted">
                      {t("imageGeneration.revisedPrompt")}
                    </p>
                    <p className="text-xs leading-5 text-foreground">
                      {selectedTask.details.revisedPrompt}
                    </p>
                  </div>
                )}

                {selectedTask.logs.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3 xl:col-span-2">
                    <p className="mb-2 text-xs font-semibold text-muted">{t("imageGeneration.logs")}</p>
                    <div className="space-y-1 text-xs leading-5 text-foreground">
                      {selectedTask.logs.slice(-6).map((log, index) => (
                        <p key={`${selectedTask.id}-${index}`}>{log}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col rounded-xl border border-border bg-card p-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">{t("imageGeneration.historyTitle")}</h2>
              <p className="text-xs text-muted">{t("imageGeneration.historySubtitle")}</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {tasks.length === 0 && !isLoadingTasks ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
                  {t("imageGeneration.noTasks")}
                </div>
              ) : (
                tasks.map((task) => {
                  const isSelected = task.id === selectedTask?.id;
                  const hasImage = Boolean(task.details?.imageUrl);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/5"
                          : "border-border bg-background hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {task.details?.model || task.name}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {task.details?.mode === "image-to-image"
                              ? t("imageGeneration.modeImageToImage")
                              : t("imageGeneration.modeTextToImage")}
                            {" · "}
                            {task.details?.size || "-"} · {new Date(task.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : task.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-danger" />
                          ) : task.status === "running" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                          ) : (
                            <Clock3 className="h-4 w-4 text-muted" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted">{formatTaskStatus(task, t)}</span>
                          <span className="text-muted">{task.progress}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full ${
                              task.status === "failed" ? "bg-danger" : "bg-accent"
                            }`}
                            style={{ width: `${Math.max(task.progress, 4)}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted">
                          {hasImage ? (
                            <span>{t("imageGeneration.resultSaved")}</span>
                          ) : task.details?.error ? (
                            <span className="truncate text-danger">{task.details.error}</span>
                          ) : (
                            <span className="truncate">{task.logs[task.logs.length - 1] || "-"}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
