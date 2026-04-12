// ============================================================
// Markdown 渲染组件
// ============================================================
// 把 LLM 返回的 Markdown 文本渲染成格式化 HTML
// 支持：标题、列表、代码块、行内代码、链接、表格、粗体斜体

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  // 代码块 / 行内代码
  code({ className, children, ...props }) {
    const isBlock = className?.includes("language-");
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

  // 段落
  p({ children }) {
    return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>;
  },

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

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
