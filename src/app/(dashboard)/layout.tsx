// ============================================================
// Dashboard 布局
// ============================================================
// (dashboard) 路由组下所有页面共享这个布局
// 登录后的页面都在这个布局里：侧边栏 + 主内容区
//
// 架构说明：
// - 这个 layout 是 Server Component（检查认证、获取 user 信息）
// - Sidebar 是 Client Component（需要 useRouter/useState/Zustand）
// - 通过 props 把 user 信息从服务端传到客户端，避免客户端再请求一次

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 服务端检查登录状态，未登录跳到 /login
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayoutClient
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </DashboardLayoutClient>
  );
}
