// ============================================================
// Markdown 渲染组件 (集成交互式 Proposal 方案卡片)
// ============================================================
// 把 LLM 返回的 Markdown 文本渲染成格式化 HTML。
// 支持标准 Markdown 语法外，还集成了解析 ```proposal 语法块的高级交互卡片。
//
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { HelpCircle, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// ============================================================
// ProposalCard - 交互式方案/建议确认卡片 (Day 12 重磅功能)
// ============================================================
interface ProposalCardProps {
  children: string;
  messageId?: string;
  onConfirm?: (solution: string) => void;
}

function ProposalCard({ children, messageId, onConfirm }: ProposalCardProps) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [context, setContext] = useState("");

  // 1. 高精细快速结构化解析
  const lines = children.split("\n");
  let title = "请选择方案";
  let tag = "决策流";
  let button = "确认提交";
  const options: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("title:")) {
      title = trimmed.replace("title:", "").trim();
    } else if (trimmed.startsWith("tag:")) {
      tag = trimmed.replace("tag:", "").trim();
    } else if (trimmed.startsWith("button:")) {
      button = trimmed.replace("button:", "").trim();
    } else if (trimmed.startsWith("-")) {
      options.push(trimmed.replace(/^-/, "").trim());
    }
  });

  // 2. 状态恢复：利用 LocalStorage 实现无感话单状态持久化
  useEffect(() => {
    if (messageId) {
      const saved = localStorage.getItem(`proposal_submitted_${messageId}`);
      if (saved === "true") {
        setSubmitted(true);
        const savedOptions = localStorage.getItem(`proposal_options_${messageId}`);
        if (savedOptions) {
          try {
            setSelectedOptions(JSON.parse(savedOptions));
          } catch {
            setSelectedOptions([]);
          }
        }
        const savedContext = localStorage.getItem(`proposal_context_${messageId}`);
        if (savedContext) {
          setContext(savedContext);
        }
      }
    }
  }, [messageId]);

  const handleToggle = (opt: string) => {
    if (submitted) return;
    setSelectedOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleSubmit = () => {
    if (submitted || selectedOptions.length === 0) return;
    setSubmitted(true);

    // 持久化状态
    if (messageId) {
      localStorage.setItem(`proposal_submitted_${messageId}`, "true");
      localStorage.setItem(`proposal_options_${messageId}`, JSON.stringify(selectedOptions));
      localStorage.setItem(`proposal_context_${messageId}`, context);
    }

    if (onConfirm) {
      // 组装文本反馈回 Chat，达成完美闭环联动
      const optionText = selectedOptions.join(" / ");
      const contextText = context.trim() ? ` (${context.trim()})` : "";
      onConfirm(`${optionText}${contextText}`);
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm max-w-md select-none border-t-foreground/10 animate-scaleIn">
      {/* 头部：标题与状态标签 */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-1.5 text-muted">
          <HelpCircle className="h-4 w-4 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Questions</span>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 transition-all ${
            submitted
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {submitted ? (
            <>
              <Check className="h-3 w-3" /> 已发送
            </>
          ) : (
            "待选择"
          )}
        </span>
      </div>

      {/* 标题 & Tag */}
      <div className="space-y-1">
        {tag && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
            {tag}
          </span>
        )}
        <h4 className="text-xs font-bold text-foreground leading-relaxed pt-1">
          {title}
        </h4>
      </div>

      {/* 选项列表 */}
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selectedOptions.includes(opt);
          return (
            <label
              key={i}
              onClick={() => handleToggle(opt)}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-xs text-foreground cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "border-accent/40 bg-accent/5 font-semibold"
                  : "border-border/80 bg-background-secondary/60 hover:bg-foreground/[0.01]"
              } ${submitted ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={submitted}
                onChange={() => {}}
                className="mt-0.5 h-3.5 w-3.5 accent-accent shrink-0"
              />
              <span className="flex-1 leading-snug break-words">{opt}</span>
            </label>
          );
        })}
      </div>

      {/* 额外建议输入框 */}
      <div className="space-y-1.5">
        <textarea
          value={context}
          disabled={submitted}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Add additional context..."
          rows={2}
          className="w-full rounded-xl border border-border/80 bg-background-secondary/60 p-2.5 text-xs text-foreground outline-none resize-none focus:border-accent/40 placeholder:text-muted/50 disabled:opacity-70"
        />
      </div>

      {/* 确认执行按钮 */}
      <button
        onClick={handleSubmit}
        disabled={submitted || selectedOptions.length === 0}
        className={`w-full rounded-xl py-2.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
          submitted
            ? "bg-[var(--sidebar-hover)] text-muted cursor-not-allowed"
            : selectedOptions.length === 0
            ? "bg-foreground/50 text-background cursor-not-allowed"
            : "bg-foreground text-background hover:opacity-90 cursor-pointer"
        }`}
      >
        {submitted ? "已发送" : button}
      </button>
    </div>
  );
}

// ============================================================
// Markdown 主组件及其样式组件映射
// ============================================================

const staticComponents: Components = {
  // 标题
  h1({ children }) {
    return <h1 className="mb-3 mt-5 text-xl font-semibold">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>;
  },

  // 段落
  p({ children }) {
    return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>;
  },

  // 列表
  ul({ children }) {
    return <ul className="mb-3 list-disc pl-6 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 list-decimal pl-6 space-y-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },

  // 链接
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        {children}
      </a>
    );
  },

  // 引用
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-accent/40 pl-4 text-muted italic">
        {children}
      </blockquote>
    );
  },

  // 表格
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="border-b border-border bg-foreground/5">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-4 py-2 text-left font-medium">{children}</th>;
  },
  td({ children }) {
    return <td className="border-t border-border px-4 py-2">{children}</td>;
  },

  // 分割线
  hr() {
    return <hr className="my-4 border-border" />;
  },
};

interface MarkdownProps {
  content: string;
  messageId?: string;
  onConfirmProposal?: (solution: string) => void;
}

export function Markdown({ content, messageId, onConfirmProposal }: MarkdownProps) {
  // 定义本地预览 URL 状态，用于控制在线预览 Modal 的呈现
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 动态创建带有闭包引用的 components 映射，拦截 ```proposal 语法块以及 downloads 静态路径
  const dynamicComponents: Components = {
    ...staticComponents,
    // 拦截 PPT / PDF 的 HTML 下载链接，重写为弹窗预览行为
    a({ href, children }) {
      if (!href) return null;

      const isDownloadLink = href.includes("/downloads/") || href.includes("/api/downloads/");
      const isHtml = href.endsWith(".html");

      // 无论如何，都将链接转换为当前应用域名下的相对路径
      // 例如从 "https://open-ppt.ai/api/downloads/ppt-xxx.html" 提取出 "/api/downloads/ppt-xxx.html"
      // 或者是从 "/downloads/ppt-xxx.html" 转换为 "/api/downloads/ppt-xxx.html"
      if (isDownloadLink) {
        const match = href.match(/\/(api\/)?downloads\/(.+)$/);
        const resolvedHref = match ? `/api/downloads/${match[2]}` : href;

        // 仅对生成的 HTML 格式（如 PPT / PDF）应用免跳转预览弹窗
        if (isHtml) {
          return (
            <button
              onClick={() => setPreviewUrl(resolvedHref)}
              className="text-accent underline underline-offset-2 hover:text-accent-hover font-medium cursor-pointer inline-flex items-center gap-0.5"
            >
              🔍 {children}
            </button>
          );
        }

        // 如果是二进制文件（Word / Excel），也使用转化后的 resolvedHref，确保下载路径正确
        return (
          <a
            href={resolvedHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            {children}
          </a>
        );
      }

      // 其他常规链接保持默认浏览器跳转行为
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          {children}
        </a>
      );
    },
    code({ className, children, ...props }) {
      const isBlock = className?.includes("language-");
      
      // 检测是否为交互式 proposal 语法块
      if (className === "language-proposal") {
        return (
          <ProposalCard messageId={messageId} onConfirm={onConfirmProposal}>
            {String(children)}
          </ProposalCard>
        );
      }

      if (isBlock) {
        return (
          <div className="my-3 overflow-x-auto rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
              <span className="text-[11px] text-muted">
                {className?.replace("language-", "") || "code"}
              </span>
            </div>
            <pre className="p-4">
              <code className="text-[13px] leading-relaxed" {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }
      return (
        <code
          className="rounded bg-foreground/5 px-1.5 py-0.5 text-[13px] font-mono text-accent"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={dynamicComponents}>
        {content}
      </ReactMarkdown>

      {/* 极富 Premium 动效的毛玻璃全屏 PPT/PDF 在线预览弹窗 */}
      {previewUrl && (
        <div 
          onClick={() => setPreviewUrl(null)} 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div 
            className="relative flex flex-col w-[92vw] h-[90vh] max-w-6xl rounded-2xl border border-border/80 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden animate-in scale-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏控制面板 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-foreground/[0.02]">
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  ✨ 智能文档在线预览
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  💡 提示：如需存为 PDF，请点击预览区右上角的「🖨️ PDF」按钮，并在系统打印窗口选择「另存为 PDF」即可。
                </span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={previewUrl}
                  download
                  className="flex items-center gap-1 rounded-xl bg-foreground text-background px-4 py-1.5 text-xs font-semibold shadow hover:opacity-90 active:scale-95 transition-all select-none"
                >
                  📥 下载 HTML 网页
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/5 text-xs font-bold text-muted hover:bg-foreground/10 hover:text-foreground active:scale-95 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* 内容预览框 */}
            <div className="flex-1 bg-background-secondary/40 relative">
              <iframe
                src={previewUrl}
                className="w-full h-full border-none bg-background"
                title="OpenCat Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
