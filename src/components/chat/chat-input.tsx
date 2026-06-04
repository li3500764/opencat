// ============================================================
// 聊天输入框组件（AI SDK 6.x）
// ============================================================
// 样式参考 Evose：圆角输入框 + 微妙投影 + 干净边框
// Enter 发送，Shift+Enter 换行

"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Image as ImageIcon, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (text: string, images?: { base64: string; type: string }[]) => void;
  onStop: () => void;
}

export function ChatInput({ isLoading, onSend, onStop }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ base64: string; type: string; name: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("只能上传图片文件进行多模态识别！");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [
          ...prev,
          {
            base64: reader.result as string,
            type: file.type,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if ((!input.trim() && images.length === 0) || isLoading) return;
    onSend(
      input.trim(),
      images.map((img) => ({ base64: img.base64, type: img.type }))
    );
    setInput("");
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {/* 输入框容器 —— Evose 风格：支持图片预览与输入框一体化，带圆角与投影 */}
        <div
          className="flex flex-col gap-2 rounded-2xl border border-border bg-input-bg px-4 py-3 transition-all focus-within:border-accent/40"
          style={{ boxShadow: "var(--input-shadow)" }}
        >
          {/* 上传图片缩略图预览 */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2 border-b border-border/40">
              {images.map((img, idx) => (
                <div key={idx} className="relative group h-14 w-14 rounded-lg overflow-hidden border border-border/60">
                  <img src={img.base64} alt={img.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* 上传图片按钮 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted/60 hover:text-foreground hover:bg-foreground/[0.04] transition-colors disabled:opacity-20"
              title="选择图片"
            >
              <ImageIcon className="h-4.5 w-4.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted/50 py-1"
              disabled={isLoading}
            />

            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90"
                title={t('chat.stopGenerating')}
              >
                <Square className="h-3 w-3" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() && images.length === 0}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:opacity-80 disabled:opacity-20 disabled:cursor-not-allowed"
                title={t('chat.sendMessage')}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted/40">
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
