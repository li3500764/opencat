// 首页：登录后重定向到 /customers 企业工作台，未登录重定向到 /login
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/customers");
  } else {
    redirect("/login");
  }
}
