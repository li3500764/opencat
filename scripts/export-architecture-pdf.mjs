import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");

const markdownPath = path.join(docsDir, "opencat-architecture-interview-cn.md");
const htmlPath = path.join(docsDir, "opencat-architecture-interview-cn.html");
const pdfPath = path.join(docsDir, "opencat-architecture-interview-cn.pdf");

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(docsDir, { recursive: true });

const markdown = readFileSync(markdownPath, "utf8");
const articleHtml = execFileSync(
  "npx",
  ["--yes", "marked", markdownPath],
  {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  },
);

const title = "OpenCat 项目架构全解（面试版）";
const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${title}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm 14mm 18mm;
      }

      :root {
        --bg: #f7f3ea;
        --paper: #fffdf8;
        --ink: #1f1a14;
        --muted: #6b6257;
        --line: #e7dccb;
        --accent: #b7791f;
        --accent-soft: #fff2dc;
        --quote: #f8efe1;
        --code: #fbf7ef;
      }

      * {
        box-sizing: border-box;
      }

      html {
        background: var(--bg);
      }

      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(211, 166, 95, 0.12), transparent 28%),
          linear-gradient(180deg, #f7f3ea 0%, #f3ede3 100%);
        font-family: "PingFang SC", "Hiragino Sans GB", "Noto Serif CJK SC",
          "Source Han Serif SC", "Songti SC", serif;
        line-height: 1.8;
      }

      .page {
        max-width: 860px;
        margin: 0 auto;
        padding: 28px;
      }

      .paper {
        background: var(--paper);
        border: 1px solid rgba(183, 121, 31, 0.12);
        border-radius: 24px;
        box-shadow:
          0 14px 40px rgba(73, 48, 16, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.85);
        overflow: hidden;
      }

      .hero {
        padding: 48px 52px 28px;
        background:
          linear-gradient(135deg, rgba(255, 243, 220, 0.95), rgba(255, 253, 248, 0.98)),
          linear-gradient(180deg, rgba(183, 121, 31, 0.06), transparent 70%);
        border-bottom: 1px solid var(--line);
      }

      .eyebrow {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(183, 121, 31, 0.12);
        color: #8a5c16;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 12px;
        font-size: 34px;
        line-height: 1.2;
        letter-spacing: 0.02em;
      }

      .subtitle {
        margin: 0;
        color: var(--muted);
        font-size: 15px;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }

      .meta span {
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid var(--line);
        color: #5f564c;
        font-size: 12px;
      }

      article {
        padding: 18px 52px 56px;
      }

      h2 {
        margin: 34px 0 12px;
        padding-top: 6px;
        font-size: 24px;
        line-height: 1.35;
        border-top: 1px solid var(--line);
      }

      h3 {
        margin: 22px 0 8px;
        font-size: 18px;
        line-height: 1.45;
        color: #2d241b;
      }

      p,
      li,
      blockquote {
        font-size: 14px;
      }

      p {
        margin: 10px 0;
      }

      ul,
      ol {
        margin: 10px 0 14px;
        padding-left: 22px;
      }

      li + li {
        margin-top: 4px;
      }

      strong {
        color: #19140f;
      }

      blockquote {
        margin: 18px 0;
        padding: 14px 16px;
        background: var(--quote);
        border-left: 4px solid var(--accent);
        border-radius: 10px;
        color: #5a4a39;
      }

      code {
        padding: 2px 6px;
        border-radius: 6px;
        background: var(--code);
        border: 1px solid #efe4d1;
        font-family: "SF Mono", "JetBrains Mono", "Menlo", monospace;
        font-size: 0.92em;
      }

      pre {
        overflow: auto;
        padding: 14px 16px;
        border-radius: 14px;
        background: #fcf8f1;
        border: 1px solid #ecdfcb;
      }

      pre code {
        padding: 0;
        border: 0;
        background: transparent;
      }

      hr {
        border: 0;
        height: 1px;
        margin: 28px 0;
        background: linear-gradient(90deg, transparent, var(--line), transparent);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 18px 0;
        font-size: 14px;
      }

      th,
      td {
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid var(--line);
      }

      th {
        background: #fbf7ef;
      }

      .footer {
        margin-top: 36px;
        color: var(--muted);
        font-size: 12px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="paper">
        <header class="hero">
          <span class="eyebrow">OpenCat Interview Notes</span>
          <h1>${title}</h1>
          <p class="subtitle">
            围绕项目定位、技术选型、运行时架构、核心链路、面试表达与简历写法整理的复习讲义。
          </p>
          <div class="meta">
            <span>项目：OpenCat</span>
            <span>方向：AI Agent 全栈 / 平台架构</span>
            <span>导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
        </header>
        <article>
          ${articleHtml}
          <p class="footer">
            Source length: ${markdown.length} chars · Generated from Markdown by local export script
          </p>
        </article>
      </section>
    </main>
  </body>
</html>
`;

writeFileSync(htmlPath, html, "utf8");

execFileSync(
  chromePath,
  [
    "--headless",
    "--disable-gpu",
    "--allow-file-access-from-files",
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ],
  {
    cwd: rootDir,
    stdio: "pipe",
  },
);

console.log(`HTML: ${path.relative(rootDir, htmlPath)}`);
console.log(`PDF: ${path.relative(rootDir, pdfPath)}`);
