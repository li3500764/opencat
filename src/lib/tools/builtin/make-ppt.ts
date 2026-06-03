// ============================================================
// 内置工具：制作 PPT 幻灯片（make_ppt）
// ============================================================
//
// 功能：生成极具现代设计感的 16:9 交互式 HTML 幻灯片，
//       支持深空黑、活力紫、香槟金等高阶毛玻璃渐变视觉，
//       自带全屏投影、翻页监听，并支持横版一键打印为矢量 PDF 幻灯片。
//
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const makePptSchema = z.object({
  title: z.string().describe("幻灯片的主标题，例如 'OpenCat 智能体商业计划书'"),
  subtitle: z.string().optional().describe("幻灯片的副标题或作者署名，例如 '主讲人：OpenCat 销售部'"),
  slides: z.array(
    z.object({
      title: z.string().describe("本页幻灯片的标题，例如 '第一部分：行业痛点与商机分析'"),
      bullets: z.array(z.string()).describe("本页幻灯片的关键陈述要点/条目内容列表（一般 3-6 条为宜）")
    })
  ).describe("幻灯片具体的页面内容列表"),
  theme: z.enum(["default", "dark", "warm", "vibrant"]).default("default").describe("幻灯片全局视觉配色风格：default(雅致灰), dark(深空黑), warm(香槟金), vibrant(活力紫)")
});

type MakePptInput = z.infer<typeof makePptSchema>;

export const makePptTool: ToolDefinition<MakePptInput> = {
  name: "make_ppt",
  description: "制作并生成精美的 16:9 横版交互式 PPT 幻灯片。输入大标题、副标题、以及每一页的标题与列点，工具会自动完成主题视觉渲染，提供在线投屏演示、全屏翻页及横向打印 PDF 链接。",
  parameters: makePptSchema,
  execute: async (input, _context) => {
    try {
      const downloadDir = path.join(process.cwd(), "public", "downloads");
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const fileId = nanoid(8);
      const fileName = `ppt-${fileId}.html`;
      const filePath = path.join(downloadDir, fileName);

      // 主题配色的 Tailwind Class 和 Gradient 设计
      const themeConfig = {
        default: {
          bg: "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-800",
          card: "bg-white/70 backdrop-blur-xl border border-slate-200/50 shadow-xl shadow-slate-100/40",
          accentText: "text-indigo-600",
          bulletDot: "bg-indigo-500",
          button: "bg-slate-800 hover:bg-slate-700 text-white",
          sub: "text-slate-500"
        },
        dark: {
          bg: "bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-100",
          card: "bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 shadow-2xl shadow-black/80",
          accentText: "text-teal-400 font-extrabold tracking-wide",
          bulletDot: "bg-teal-400 shadow-lg shadow-teal-400/40",
          button: "bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold",
          sub: "text-slate-400"
        },
        warm: {
          bg: "bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-yellow-50/50 text-amber-950",
          card: "bg-white/80 backdrop-blur-xl border border-amber-200/40 shadow-xl shadow-amber-950/5",
          accentText: "text-amber-700",
          bulletDot: "bg-amber-600",
          button: "bg-amber-800 hover:bg-amber-700 text-white",
          sub: "text-amber-700/70"
        },
        vibrant: {
          bg: "bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-950 text-slate-100",
          card: "bg-slate-900/50 backdrop-blur-2xl border border-indigo-500/20 shadow-2xl shadow-indigo-500/5",
          accentText: "text-pink-400 font-black",
          bulletDot: "bg-pink-500 shadow-md shadow-pink-500/50 animate-pulse",
          button: "bg-pink-600 hover:bg-pink-500 text-white font-bold",
          sub: "text-indigo-200/60"
        }
      }[input.theme];

      // 组装首屏 Cover 幻灯片 + 内容幻灯片列表
      const slidesData = [
        { isCover: true, title: input.title, subtitle: input.subtitle || "OpenCat AI 智能制作" },
        ...input.slides.map(s => ({ isCover: false, title: s.title, bullets: s.bullets }))
      ];

      // 生成 Slides HTML 节点
      const slidesHtml = slidesData.map((slide, idx) => {
        if (slide.isCover) {
          return `
          <!-- Slide ${idx} (Cover) -->
          <div id="slide-${idx}" class="slide-card absolute inset-0 flex flex-col justify-center items-center p-12 transition-all duration-500 transform opacity-100 scale-100">
            <div class="max-w-4xl text-center space-y-6 animate-fadeIn">
              <span class="no-print inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-accent-10 ${themeConfig.accentText} bg-white/20">
                ✨ OpenCat Document Toolset
              </span>
              <h1 class="text-4xl md:text-6xl font-black tracking-tight leading-tight uppercase font-sans">
                ${slide.title}
              </h1>
              ${slide.subtitle ? `<p class="text-base md:text-xl font-medium tracking-wide ${themeConfig.sub}">${slide.subtitle}</p>` : ""}
              <div class="no-print w-24 h-1 bg-gradient-to-r from-transparent via-current to-transparent mx-auto mt-8 opacity-40"></div>
            </div>
          </div>
          `;
        } else {
          return `
          <!-- Slide ${idx} (Content) -->
          <div id="slide-${idx}" class="slide-card absolute inset-0 flex flex-col justify-between p-12 transition-all duration-500 transform opacity-0 scale-95 pointer-events-none">
            
            <!-- Slide Header -->
            <div class="flex justify-between items-center border-b border-current/10 pb-4">
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight truncate max-w-xl ${themeConfig.accentText}">
                ${slide.title}
              </h2>
              <span class="no-print text-xs font-bold font-mono opacity-50">${idx} / ${slidesData.length - 1}</span>
            </div>

            <!-- Slide Body Content -->
            <div class="my-auto py-6 max-w-3xl">
              <ul class="space-y-4 md:space-y-6">
                ${slide.bullets?.map((b, bIdx) => `
                  <li class="flex items-start gap-4 text-base md:text-lg font-medium leading-relaxed animate-fadeIn" style="animation-delay: ${bIdx * 100}ms">
                    <span class="w-3.5 h-3.5 rounded-full shrink-0 ${themeConfig.bulletDot} mt-1.5 flex items-center justify-center"></span>
                    <span class="font-sans">${b.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
                  </li>
                `).join("") || ""}
              </ul>
            </div>

            <!-- Slide Footer -->
            <div class="flex justify-between items-center text-[10px] opacity-40 pt-4 border-t border-current/5">
              <span>${input.title}</span>
              <span>OpenCat Presentation Suite</span>
            </div>

          </div>
          `;
        }
      }).join("\n");

      // 4. 构建包含完整演示控制器及打印样式的 HTML 模板
      const pptTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${input.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Noto+Sans+SC:wght@300;400;700;900&display=swap');
    
    body {
      font-family: 'Outfit', 'Noto Sans SC', sans-serif;
      overflow: hidden;
    }

    .glass-card {
      aspect-ratio: 16 / 9;
    }

    /* 完美的横向打印成 PDF 幻灯片排版 */
    @media print {
      body {
        overflow: visible !important;
        /* 强制在打印时渲染所有背景与颜色（高保真保留深色主题） */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
      #presentation-wrapper {
        display: block !important;
        box-shadow: none !important;
        border: none !important;
        background: transparent !important;
        width: 100% !important;
        height: auto !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .glass-card {
        aspect-ratio: auto !important;
        width: 100% !important;
        height: auto !important;
        box-shadow: none !important;
        border: none !important;
        background: transparent !important;
      }
      .slide-card {
        position: relative !important;
        display: flex !important;
        opacity: 1 !important;
        transform: none !important;
        pointer-events: auto !important;
        page-break-after: always !important;
        width: 100vw !important;
        height: 100vh !important;
        box-sizing: border-box !important;
        padding: 3rem !important;
        /* 去除虚线分割线以实现精美 PDF 排版 */
        border-bottom: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }

    @page {
      size: landscape;
      margin: 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  </style>
</head>
<body class="flex h-screen w-screen items-center justify-center p-0 md:p-6 ${themeConfig.bg} select-none">

  <!-- 演示区总容器 -->
  <div id="presentation-wrapper" class="relative w-full max-w-5xl glass-card rounded-2xl overflow-hidden ${themeConfig.card} flex flex-col justify-between">
    
    <!-- 顶栏快捷操作区 (仅在大屏幕及网页显示，打印不可见) -->
    <div class="no-print absolute top-4 right-4 z-50 flex items-center gap-2">
      <button onclick="toggleFullScreen()" class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/15 text-xs font-bold hover:bg-black/25 active:scale-95 transition-all" title="全屏投屏">
        📺
      </button>
      <button onclick="window.print()" class="flex h-7 px-2.5 items-center justify-center rounded-lg bg-black/15 text-xs font-bold hover:bg-black/25 active:scale-95 transition-all gap-1" title="打印/存为横版 PDF">
        🖨️ <span class="text-[10px]">PDF</span>
      </button>
    </div>

    <!-- 幻灯片渲染卡片包 -->
    <div class="relative flex-1 w-full h-full overflow-hidden">
      ${slidesHtml}
    </div>

    <!-- 页脚与翻页控制器 (网页显示，打印不可见) -->
    <div class="no-print absolute bottom-4 left-0 right-0 z-50 flex items-center justify-between px-12">
      <div class="text-[10px] opacity-40 font-mono tracking-wider">
        键盘 ← / → 键可流畅切页
      </div>
      <div class="flex items-center gap-3">
        <button id="prev-btn" onclick="prevSlide()" class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/15 text-xs font-bold hover:bg-black/25 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none">
          ◀
        </button>
        <span id="page-indicator" class="text-xs font-mono font-bold opacity-60">1 / ${slidesData.length}</span>
        <button id="next-btn" onclick="nextSlide()" class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/15 text-xs font-bold hover:bg-black/25 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none">
          ▶
        </button>
      </div>
    </div>

  </div>

  <!-- 网页端交互与控制脚本 -->
  <script class="no-print">
    const slidesCount = ${slidesData.length};
    let currentIdx = 0;

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const indicator = document.getElementById("page-indicator");

    function showSlide(index) {
      if (index < 0 || index >= slidesCount) return;
      
      // 隐藏当前 slide
      const oldSlide = document.getElementById(\`slide-\${currentIdx}\`);
      if (oldSlide) {
        oldSlide.classList.remove("opacity-100", "scale-100");
        oldSlide.classList.add("opacity-0", "scale-95", "pointer-events-none");
      }

      currentIdx = index;

      // 呈现新 slide
      const newSlide = document.getElementById(\`slide-\${currentIdx}\`);
      if (newSlide) {
        newSlide.classList.remove("opacity-0", "scale-95", "pointer-events-none");
        newSlide.classList.add("opacity-100", "scale-100");
      }

      // 控制器状态更新
      prevBtn.disabled = currentIdx === 0;
      nextBtn.disabled = currentIdx === slidesCount - 1;
      indicator.innerText = \`\${currentIdx + 1} / \${slidesCount}\`;
    }

    function prevSlide() {
      if (currentIdx > 0) showSlide(currentIdx - 1);
    }

    function nextSlide() {
      if (currentIdx < slidesCount - 1) showSlide(currentIdx + 1);
    }

    // 监听键盘左右按键
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "PageUp") prevSlide();
      if (e.key === "PageDown") nextSlide();
    });

    // 全屏投屏控制
    function toggleFullScreen() {
      const wrapper = document.getElementById("presentation-wrapper");
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(err => {
          alert(\`开启全屏失败: \${err.message}\`);
        });
      } else {
        document.exitFullscreen();
      }
    }

    // 初始化显示首屏
    showSlide(0);
  </script>
</body>
</html>
      `.trim();

      fs.writeFileSync(filePath, pptTemplate, "utf-8");

      return {
        success: true,
        data: {
          title: input.title,
          fileName,
          downloadUrl: `/api/downloads/${fileName}`,
          message: `幻灯片「${input.title}」高保真渲染成功！采用「${input.theme}」主题配色。您可以点击下方链接查看在线交互 PPT（支持左右按键切页、网页一键投屏），或通过右上角打印按钮一键存为完美的横版 A4 PDF 演示文稿！`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `生成 PPT 失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
