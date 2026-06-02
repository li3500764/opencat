"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ChatWorkerManager } from "../chat/worker-manager";

interface DashboardLayoutClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  children: React.ReactNode;
}

/**
 * Dashboard 客户端自适应布局包装器 (Day 12 移动端加固)
 * 职责：
 * 1. 在宽屏设备下，侧边栏保持物理常驻，不占用额外性能。
 * 2. 在窄屏/手机端设备下，侧边栏默认收缩，顶部展示精致的 Header 菜单。
 * 3. 点击菜单可弹出具有高模糊 Glassmorphism 渐变阴影的悬浮抽屉。
 * 4. 路由变更时，移动端抽屉自动折叠，避免阻挡视线。
 */
export function DashboardLayoutClient({ user, children }: DashboardLayoutClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // 监听路由改变，在窄屏下跳转后自动折叠侧边栏
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // 防止侧边栏打开时，背景页面产生多余的滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 1. 移动端遮罩层 Backdrop (仅在抽屉打开时显示) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        />
      )}

      {/* 2. 侧边栏容器：窄屏下固定绝对定位抽屉，宽屏下物理静态占位 (md:h-full md:shrink-0 双倍加固防挤压变形) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-60 transform flex-col transition-transform duration-300 ease-in-out md:static md:h-full md:shrink-0 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar user={user} />
      </div>

      {/* 3. 右侧主内容与移动端 Header 结合区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 移动端顶栏 Header (仅在 md 以下可见) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background-secondary px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground transition-colors"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">OpenCat</span>
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                CRI
              </span>
            </div>
          </div>

          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
        </header>

        {/* 页面主视图容器，在移动端扣除 56px 高度以保证独立滚动 */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* 4. 后台常驻影子工作线程池 */}
      <ChatWorkerManager />
    </div>
  );
}
