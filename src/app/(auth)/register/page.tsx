"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cat, Loader2, Mail, Lock, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. 调用注册 API 创建用户
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // 2. 注册成功后自动登录
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // 注册成功但自动登录失败，跳到登录页让用户手动登录
        router.push("/login");
      } else {
        router.push("/chat");
        router.refresh();
      }
    } catch {
      setError(t('auth.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <Cat className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t('auth.createAccountTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{t('auth.createAccountSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={t('auth.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
            />
          </div>

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
              placeholder={t('auth.passwordHint')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('auth.createAccount')
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.hasAccount')}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.signInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
