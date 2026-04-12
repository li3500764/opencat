// ============================================================
// ThemeProvider — 初始化主题
// ============================================================
// 在客户端挂载时从 localStorage 读取主题偏好
// 用 useLayoutEffect 防止闪屏（先于渲染同步设置 class）

"use client";

import { useLayoutEffect } from "react";
import { useThemeStore } from "@/stores/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useThemeStore((s) => s.setTheme);

  useLayoutEffect(() => {
    // 读取 localStorage 中保存的主题，默认 light
    const saved = localStorage.getItem("opencat-theme") as "light" | "dark" | null;
    const theme = saved || "light";
    setTheme(theme);
  }, [setTheme]);

  return <>{children}</>;
}
