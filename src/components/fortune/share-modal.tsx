"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X, Sparkles, Quote } from "lucide-react";
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
        scale: 3, // 高清截图
        useCORS: true,
        backgroundColor: "#09090b",
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

  // 精准提取判词金句
  const extractQuote = () => {
    const textLines = interpretation.split("\n").map((l) => l.trim()).filter(Boolean);
    const index = textLines.findIndex(
      (l) => l.includes("✨") || l.includes("专属赛博判词") || l.includes("分享金句")
    );
    
    if (index !== -1) {
      const headingLine = textLines[index];
      // 如果金句在同一行（冒号后面）
      if (headingLine.includes("：") || headingLine.includes(":")) {
        const afterColon = headingLine.replace(/^.*?[：:]\s*/, "").replace(/[*"]/g, "").trim();
        if (afterColon) return afterColon;
      }
      // 否则金句在下一行（或下面多行）
      if (index + 1 < textLines.length) {
        return textLines.slice(index + 1).join("\n").replace(/[*"]/g, "");
      }
    }
    // 降级兜底
    return textLines[textLines.length - 1].replace(/[*"]/g, "");
  };

  const goldenQuote = extractQuote();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#121212] shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-200">专属分享卡片</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-black p-4 sm:p-8">
          {/* 这里是被截图的卡片区域 */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-2xl bg-zinc-950 p-8 shadow-2xl ring-1 ring-white/10 isolate"
          >
            {/* 炫酷渐变与装饰背景 */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/40 via-zinc-950 to-zinc-950 -z-10" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-[80px] -z-10" />
            <div className="absolute top-4 right-4 text-white/5 -z-10">
              <Quote className="h-32 w-32 rotate-180" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              {/* 头部信息 */}
              <div className="mb-10 flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">{profileName}</h2>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-accent/20 px-2 py-1 text-xs font-medium text-amber-500">
                      {methodLabel}
                    </span>
                    {(dayPillar || soul) && (
                      <span className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-medium text-zinc-300">
                        {dayPillar && `日主 ${dayPillar}`}
                        {soul && `命主 ${soul}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>

              {/* 金句核心区 */}
              <div className="mb-12 relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80 mb-4">
                  Cyber Verdict
                </p>
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-accent to-transparent opacity-50" />
                  <p className="text-lg sm:text-xl font-medium leading-relaxed text-zinc-100 italic break-words whitespace-pre-wrap">
                    &quot;{goldenQuote}&quot;
                  </p>
                </div>
              </div>

              {/* 底部水印区 */}
              <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-[11px] font-black text-zinc-950">
                    OC
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold tracking-widest text-zinc-200">
                      OpenCat Astro
                    </span>
                    <span className="text-[9px] text-zinc-500 tracking-wider">
                      赛博算命师 · AI 生成
                    </span>
                  </div>
                </div>
                <div className="h-10 w-10 opacity-30 invert">
                   {/* 假装有个二维码或图案 */}
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#121212] p-4 sm:px-6">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {isGenerating ? "正在生成超清截图..." : "保存到本地相册"}
          </button>
        </div>
      </div>
    </div>
  );
}
