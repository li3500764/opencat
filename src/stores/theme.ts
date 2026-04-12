// ============================================================
// Theme Store（Zustand）
// ============================================================
// 管理亮/暗主题切换，持久化到 localStorage
// 通过给 <html> 添加/移除 .dark class 来切换主题

import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // 默认 light，初始化时会在 ThemeProvider 里从 localStorage 读取
  theme: "light",

  setTheme: (theme) => {
    set({ theme });
    // 同步到 DOM
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // 持久化
    try {
      localStorage.setItem("opencat-theme", theme);
    } catch {}
  },

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },
}));
