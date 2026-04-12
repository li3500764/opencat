// 首页：重定向到 /chat（登录后）或 /login（未登录）
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  } else {
    redirect("/login");
  }
}
