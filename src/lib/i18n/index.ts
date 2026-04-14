// ============================================================
// i18n — 核心模块
// ============================================================
// 轻量 i18n 实现，不依赖 next-intl / react-i18next
//
// 用法：
//   const { t } = useTranslation();
//   t('sidebar.newChat')        → "New Chat" 或 "新对话"
//   t('dashboard.minsAgo', { n: 5 }) → "5m ago" 或 "5分钟前"
//
// 语言切换：
//   const { locale, setLocale } = useLocaleStore();
//   setLocale('zh');

import { create } from "zustand";
import en, { type TranslationKeys } from "./en";
import zh from "./zh";

// ---- 支持的语言 ----
export type Locale = "en" | "zh";

const translations: Record<Locale, TranslationKeys> = { en, zh };

// ---- Zustand Store：语言状态持久化到 localStorage ----
interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: (typeof window !== "undefined"
    ? (localStorage.getItem("opencat_locale") as Locale) || "en"
    : "en"),
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("opencat_locale", locale);
    }
    set({ locale });
  },
}));

// ---- 类型安全的翻译 key 路径 ----
// 把嵌套对象拍平为 "sidebar.newChat" 这种点分路径
type FlattenKeys<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? {
      [K in keyof T]: T[K] extends Record<string, unknown>
        ? FlattenKeys<T[K], `${Prefix}${K & string}.`>
        : `${Prefix}${K & string}`;
    }[keyof T]
  : never;

export type TranslationKey = FlattenKeys<TranslationKeys>;

// ---- 翻译函数 ----
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

// ---- Hook：获取翻译函数 ----
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const dict = translations[locale];

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let text = getNestedValue(dict as unknown as Record<string, unknown>, key);
    // 替换模板变量 {n} → 实际值
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  }

  return { t, locale };
}

// 导出翻译类型供其他文件使用
export type { TranslationKeys };
