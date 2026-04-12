// ============================================================
// 主题切换按钮
// ============================================================
// 太阳/月亮图标，点击切换亮/暗主题

"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/stores/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--sidebar-hover)] hover:text-foreground"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
