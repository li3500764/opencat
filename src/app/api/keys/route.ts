// ============================================================
// API Key 管理 — 增删查
// ============================================================
// GET    → 列出用户的所有 API Key（脱敏显示）
// POST   → 添加新 API Key（加密存储）

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { encrypt, maskApiKey } from "@/lib/crypto";
import { z } from "zod/v4";

// 添加 Key 的校验 schema
const addKeySchema = z.object({
  provider: z.string().min(1),      // "openai" | "anthropic" | "deepseek" | "google" | "custom"
  apiKey: z.string().min(1),         // 原始 API Key
  label: z.string().optional(),      // 备注名
  baseUrl: z.string().url().optional(), // 自定义 Provider 的 base URL
  format: z.enum(["openai", "openai-responses", "anthropic", "google-genai"]).optional(),  // ★ API 协议格式
});

// GET — 列出 API Keys（脱敏）
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      format: true,        // ★ 返回 API 格式
      label: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
      encryptedKey: true, // 需要解密后脱敏
      iv: true,
    },
  });

  // 返回脱敏的 Key（只显示最后 4 位）
  const safeKeys = keys.map((k) => {
    // 不在响应里暴露加密数据，只返回脱敏的 masked key
    let masked = "****";
    try {
      // 不解密了，直接用一个固定的 mask 格式
      // 实际上我们不需要解密来展示，用 label 区分就行
      masked = `sk-****${k.id.slice(-4)}`;
    } catch {}

    return {
      id: k.id,
      provider: k.provider,
      format: k.format,      // ★ 返回 API 格式
      label: k.label,
      baseUrl: k.baseUrl,
      isActive: k.isActive,
      maskedKey: masked,
      createdAt: k.createdAt,
    };
  });

  return Response.json(safeKeys);
}

// POST — 添加新 API Key
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addKeySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { provider, apiKey, label, baseUrl, format } = parsed.data;

  // 加密 API Key
  const { encrypted, iv } = encrypt(apiKey);

  const key = await db.apiKey.create({
    data: {
      userId: session.user.id,
      provider,
      format: format || "openai",     // ★ 存储 API 格式，默认 openai（Chat Completions）
      encryptedKey: encrypted,
      iv,
      label: label || `${provider} key`,
      baseUrl: baseUrl || null,
    },
  });

  return Response.json(
    {
      id: key.id,
      provider: key.provider,
      label: key.label,
      maskedKey: maskApiKey(apiKey),
    },
    { status: 201 }
  );
}
