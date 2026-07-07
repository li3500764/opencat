---
kind: frontend_style
name: Tailwind v4 + CSS 变量主题系统
category: frontend_style
scope:
    - '**'
source_files:
    - src/app/globals.css
    - postcss.config.mjs
    - next.config.ts
    - src/app/layout.tsx
    - src/components/layout/theme-provider.tsx
    - src/stores/theme.ts
    - src/lib/utils.ts
    - package.json
---

## 样式体系概览
OpenCat 前端采用 **Next.js App Router + Tailwind CSS v4** 作为唯一样式方案，通过 CSS 自定义属性（CSS Variables）集中管理设计令牌，并以 `<html class="dark">` 驱动亮/暗主题切换。全局样式集中在 `src/app/globals.css`，组件层完全基于 Tailwind 原子类与少量语义化 CSS 组合。

## 核心架构
- **构建链**：`postcss.config.mjs` 仅注册 `@tailwindcss/postcss`，无 Sass/Less；`next.config.ts` 在 Tauri 模式输出静态资源、生产模式走 standalone。
- **字体**：根布局通过 `next/font/google` 注入 Geist Sans/Mono，并映射到 CSS 变量 `--font-geist-sans` / `--font-geist-mono`，供 Tailwind `@theme inline` 使用。
- **主题状态**：Zustand store（`src/stores/theme.ts`）维护 `light|dark`，`useLayoutEffect` 同步到 `document.documentElement.classList`，避免 hydration mismatch；`ThemeProvider`（`src/components/layout/theme-provider.tsx`）在客户端挂载时从 `localStorage("opencat-theme")` 恢复偏好。

## 设计令牌（Design Tokens）
所有颜色、阴影、圆角等通过 `:root` 与 `.dark` 下的 CSS 变量声明，再经 `@theme inline` 暴露给 Tailwind 的 `bg-*` / `text-*` / `border-*` / `shadow-*` 等原子类消费：
- 基础色板：`--background` / `--foreground` / `--muted` / `--border` / `--card` / `--accent` / `--danger` / `--success`
- 交互态：`--sidebar-hover` / `--sidebar-active` / `--input-shadow` / `--message-user-bg` / `--message-user-text`
- Fortune V2 专属：`--fortune-bazi` / `--fortune-ziwei` / `--fortune-zhouyi` / `--fortune-tarot` / `--fortune-xiaoliuren` 及对应 glow/bg 变体
- 动画：`fortune-glow` / `fortune-rotate` / `fortune-float` / `fortune-shimmer` / `fortune-fade-in-up` / `fortune-cycle` / `fortune-ripple` / `fortune-particle` / `fortune-cursor` / `fortune-twinkle` 等 keyframes

## 组件库约定
- 通用 UI 目录 `src/components/ui` 为空，项目未引入 shadcn/ui 或自建基础组件包，直接复用 Tailwind 原子类。
- 业务组件按功能域分目录（`chat/`、`customers/`、`dashboard/`、`fortune/`、`fortune-v2/`、`layout/`），每个文件内用 `className` 拼接 Tailwind 类。
- 条件类合并统一通过 `src/lib/utils.ts` 导出的 `cn(...)` 函数（`clsx` + `tailwind-merge`），用法示例：`cn("px-4 py-2", isActive && "bg-blue-500", className)`。

## 主题切换机制
1. `ThemeProvider` 在客户端首次渲染前读取 `localStorage.opencat-theme`，调用 `setTheme`。
2. `useThemeStore.setTheme` 写入 Zustand 状态、追加/移除 `<html>.dark`、持久化到 localStorage。
3. `globals.css` 中 `:root` 与 `.dark` 两套变量自动生效，配合全局 `transition` 实现平滑过渡。
4. 根布局 `<html>` 显式设置 `suppressHydrationWarning`，避免服务端默认 light 与客户端 dark 之间的水合差异。

## 开发者规范
- **优先使用 Token 类名**：如 `bg-background`、`text-muted`、`border-border`、`bg-card`，而非硬编码十六进制值。
- **类合并入口**：需要动态拼接或覆盖父组件传入 `className` 时，一律使用 `cn()`，禁止手写 `clsx` + `twMerge`。
- **新增颜色**：先在 `:root` / `.dark` 下定义 CSS 变量，再通过 `@theme inline` 映射为 `--color-*`，随后即可在 Tailwind 中以 `bg-xxx` 形式使用。
- **Fortune 页面**：遵循 `fortune-page` / `fortune-card` / `fortune-input` / `fortune-btn-primary` 等已有语义化类，保持沉浸式暗黑风格一致。
- **滚动条与过渡**：全局已定义 `::-webkit-scrollbar` 与 `*` 的 `transition`，不要重复覆盖，除非有明确需求。
- **外部 HTML 生成**（PDF/PPT 工具）：通过 CDN 注入 tailwindcss.com 脚本渲染，不属于应用主样式链路，需单独考虑加载策略。