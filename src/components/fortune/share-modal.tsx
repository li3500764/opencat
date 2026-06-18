"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X, QrCode } from "lucide-react";
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
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
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
      (l) => l.includes("✨") || l.includes("核心批言") || l.includes("判词") || l.includes("分享金句")
    );
    
    if (index !== -1) {
      const headingLine = textLines[index];
      if (headingLine.includes("：") || headingLine.includes(":")) {
        const afterColon = headingLine.replace(/^.*?[：:]\s*/, "").replace(/[*"]/g, "").trim();
        if (afterColon) return afterColon;
      }
      if (index + 1 < textLines.length) {
        return textLines.slice(index + 1).join("\n").replace(/[*"]/g, "");
      }
    }
    return textLines[textLines.length - 1].replace(/[*"]/g, "");
  };

  const rawQuote = extractQuote().replace(/^["“]+|["”]+$/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-700">专属分享卡片</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-100 p-4 sm:p-8">
          <div
            ref={cardRef}
            className="relative bg-white px-8 py-10 shadow-sm ring-1 ring-zinc-200 isolate"
          >
            <div className="relative z-10 flex flex-col h-full">
              {/* 头部信息与 Logo */}
              <div className="mb-12 flex items-start justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain opacity-90" />
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-1">
                    {methodLabel}
                  </p>
                  {(dayPillar || soul) && (
                    <p className="text-[10px] font-medium text-zinc-400">
                      {dayPillar && `日主 ${dayPillar}`}
                      {soul && `命主 ${soul}`}
                    </p>
                  )}
                </div>
              </div>

              <h2 className="text-[28px] font-semibold text-zinc-900 tracking-tight leading-none mb-10">
                {profileName}
              </h2>

              {/* 核心批言区：极简留白 */}
              <div className="mb-16 relative">
                <div className="absolute -left-5 top-0 bottom-0 w-[3px] bg-zinc-200" />
                <p className="text-lg sm:text-[20px] font-medium leading-[1.8] text-zinc-800 break-words whitespace-pre-wrap">
                  {rawQuote}
                </p>
              </div>

              {/* 底部极简信息 */}
              <div className="mt-auto pt-6 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold tracking-wider text-zinc-800">
                    OpenCat Astro
                  </span>
                  <span className="text-[10px] text-zinc-400 tracking-widest uppercase mt-1">
                    专业命理分析引擎
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-40">
                   <QrCode className="h-7 w-7 text-zinc-900" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 bg-white p-4 sm:px-6">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {isGenerating ? "正在渲染海报..." : "保存高清海报"}
          </button>
        </div>
      </div>
    </div>
  );
}
