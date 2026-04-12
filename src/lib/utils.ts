// ============================================================
// CSS 工具函数
// ============================================================
// 用于合并 TailwindCSS 类名，解决两个问题：
// 1. 条件拼接（某个类只在特定条件下添加）→ clsx 处理
// 2. 冲突覆盖（父组件传的 "p-4" 要覆盖子组件默认的 "p-2"）→ twMerge 处理
//
// 用法：cn("px-4 py-2", isActive && "bg-blue-500", className)

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
