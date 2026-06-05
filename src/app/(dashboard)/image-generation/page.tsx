"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  models: { id: string; name: string }[];
}

interface GeneratedImage {
  url: string;
  markdown: string;
  revised_prompt: string;
}

const IMAGE_KEYWORDS = ["image", "dall", "flux", "midjourney", "mj", "sd", "stable-diffusion"];
const SIZES = [
  { value: "1024x1024", label: "1K", hint: "1024" },
  { value: "2048x2048", label: "2K", hint: "2048" },
  { value: "4096x4096", label: "4K", hint: "4096" },
  { value: "1024x1792", label: "9:16", hint: "Portrait" },
  { value: "1792x1024", label: "16:9", hint: "Wide" },
] as const;

const DEFAULT_PROMPT =
  "Generate a premium 3D app icon, 1:1 square, centered subject, no text. A chubby cream-colored cartoon cat in Pop Mart blind box toy style with smooth matte clay texture, symmetrical light orange maple leaf cheek markings, dark brown fringe, confident smirk, one winking eye and one glowing soft blue cybernetic AI eye. Soft studio lighting, subtle drop shadow, white rounded-rectangle app icon frame, clean white background, iOS App Store premium style, octane render quality.";

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

export default function ImageGenerationPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("1024x1024");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [quality, setQuality] = useState("");
  const [style, setStyle] = useState("");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKey = useMemo(
    () => keys.find((key) => key.id === selectedKeyId) || null,
    [keys, selectedKeyId]
  );

  const models = selectedKey?.models || [];

  const fetchKeys = async () => {
    setIsLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error("API key list failed to load");
      const data = (await res.json()) as ApiKeyItem[];
      setKeys(data);
      const initialKey = pickInitialKey(data);
      if (initialKey) {
        setSelectedKeyId(initialKey.id);
        const initialModel =
          initialKey.models.find((model) => isImageModel(model.id)) ||
          initialKey.models[0];
        setSelectedModel(initialModel?.id || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "API key list failed to load");
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

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

    setIsGenerating(true);
    setError(null);
    setImage(null);

    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeyId: selectedKeyId,
          model: selectedModel,
          prompt,
          size,
          quality: quality.trim() || undefined,
          style: style.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Image generation failed");
      }

      setImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = Boolean(selectedKeyId && selectedModel && prompt.trim() && !isGenerating);

  return (
    <div className="flex h-full overflow-y-auto bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[420px_1fr]">
        <section className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">AI Image Studio</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI 生图</h1>
            <p className="text-sm leading-6 text-muted">
              独立调用生图 API，不走 Agent 工具链。选择专用 Key、模型和尺寸后直接生成。
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">生成参数</h2>
                <p className="text-xs text-muted">Key 和模型由你明确指定</p>
              </div>
              <button
                onClick={fetchKeys}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                title="刷新 Key"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingKeys ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">API Key</span>
                <select
                  value={selectedKeyId}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">选择 API Key</option>
                  {keys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label} {key.baseUrl ? `- ${key.baseUrl}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">模型</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                  disabled={!selectedKey}
                >
                  <option value="">选择模型</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted">尺寸</span>
                <div className="grid grid-cols-5 gap-2">
                  {SIZES.map((item) => (
                    <button
                      key={item.value}
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
                <span className="text-xs font-medium text-muted">Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-44 w-full resize-none rounded-lg border border-border bg-input-bg px-3 py-3 text-sm leading-6 outline-none focus:border-accent"
                  placeholder="描述你想生成的图片"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">Quality</span>
                  <input
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                    placeholder="standard / hd"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">Style</span>
                  <input
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm outline-none focus:border-accent"
                    placeholder="vivid / natural"
                  />
                </label>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {isGenerating ? "生成中" : "开始生成"}
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[640px] flex-col rounded-xl border border-border bg-background-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">预览</h2>
              <p className="text-xs text-muted">生成结果会显示在这里</p>
            </div>
            {image && (
              <a
                href={image.url}
                download="opencat-generated-image.png"
                className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </a>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card p-4">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3 text-muted">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm">正在调用生图 API...</p>
              </div>
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt="Generated image"
                className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center text-muted">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <ImageIcon className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">还没有图片</p>
                  <p className="mt-1 max-w-sm text-xs leading-5">
                    选择你的 heiyu 生图 Key 和 gpt-image-2，然后点击开始生成。
                  </p>
                </div>
              </div>
            )}
          </div>

          {image?.revised_prompt && (
            <div className="mt-4 rounded-lg border border-border bg-card p-3">
              <p className="mb-1 text-xs font-semibold text-muted">Revised Prompt</p>
              <p className="text-xs leading-5 text-foreground">{image.revised_prompt}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
