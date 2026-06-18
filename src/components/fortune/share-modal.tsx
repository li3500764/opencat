"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";


interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileName: string;
  methodLabel: string;
  interpretation: string;
  dayPillar?: string;
  soul?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  profileName,
  methodLabel,
  interpretation,
  dayPillar,
  soul,
}: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#09090b", // Match dark background
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `OpenCat_Astro_${profileName}_${new Date().getTime()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("生成图片失败", err);
      alert("生成图片失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  // 提取判词金句（如果有的话，通常在最后一行，或者寻找包含✨的句子）
  const lines = interpretation.split("\n").filter((l) => l.trim().length > 0);
  const goldenQuote = lines.find((l) => l.includes("✨") || l.includes("专属赛博判词")) 
    || lines[lines.length - 1] 
    || "万物皆有裂痕，那是光照进来的地方。";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">专属分享卡片</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-background-secondary p-4 sm:p-6">
          {/* 这里是被截图的卡片区域 */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-black p-6 shadow-xl ring-1 ring-white/10"
          >
            {/* 装饰性背景 */}
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-[50px]" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-600/20 blur-[50px]" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">{profileName}</h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    {methodLabel}
                    {dayPillar && ` · 日主 ${dayPillar}`}
                    {soul && ` · 命主 ${soul}`}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-white/5 p-4 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent/80">Cyber Verdict</p>
                <p className="mt-2 text-base font-medium leading-7 text-zinc-200">
                  {goldenQuote.replace(/^.*?[：:]\s*/, "")}
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[10px] font-bold text-black">
                      OC
                    </div>
                    <span className="text-[11px] font-medium tracking-widest text-zinc-400">
                      OpenCat Astro
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    赛博算命师 · AI 生成
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card p-4 sm:px-6">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isGenerating ? "正在生成高质量图片..." : "保存到本地相册"}
          </button>
        </div>
      </div>
    </div>
  );
}
