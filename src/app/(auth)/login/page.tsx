// ============================================================
// 登录页面
// ============================================================
// Next.js App Router 里，page.tsx 就是路由对应的页面组件
// 这个文件位于 src/app/(auth)/login/page.tsx
// 对应的 URL 是 /login（(auth) 是路由组，不参与 URL）

"use client"; // 有交互逻辑（表单提交、状态管理）的组件必须标记为客户端组件

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cat, Loader2, Mail, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// lucide-react v1.8 移除了品牌图标，GitHub 图标用内联 SVG
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // signIn("credentials") 调用 NextAuth 的 Credentials provider
      // redirect: false 阻止自动跳转，我们自己控制跳转
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('auth.invalidCredentials'));
      } else {
        router.push("/chat");
        router.refresh(); // 刷新 server components 让它们读到新的 session
      }
    } catch {
      setError(t('auth.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubLogin() {
    // signIn("github") 会跳转到 GitHub 授权页
    // 授权完后 GitHub 回调到 /api/auth/callback/github，NextAuth 自动处理
    await signIn("github", { callbackUrl: "/chat" });
  }

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <Cat className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{t('auth.signInSubtitle')}</p>
        </div>

        {/* GitHub OAuth 按钮 */}
        <button
          onClick={handleGitHubLogin}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          <GitHubIcon className="h-4 w-4" />
          {t('auth.continueWithGithub')}
        </button>

        {/* 分割线 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* 邮箱密码表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        {/* 注册链接 */}
        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.noAccount')}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
