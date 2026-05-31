// ============================================================
// API Key 管理 — 增删查
// ============================================================
// GET    → 列出用户的所有 API Key（脱敏显示）
// POST   → 添加新 API Key（加密存储）

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { encrypt, isEncryptionConfigError, maskApiKey } from "@/lib/crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";

const modelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

// 添加 Key 的校验 schema
const addKeySchema = z.object({
  apiKey: z.string().trim().min(1), // 原始 API Key
  label: z.string().trim().optional(), // 备注名
  baseUrl: z.string().trim().optional().nullable(), // 自定义 Base URL
  models: z.array(modelSchema).min(1, "至少需要配置一个模型"),
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
      format: true,        
      label: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
      encryptedKey: true, 
      iv: true,
      models: true, // 也需要返回给前端展示使用
    },
  });

  // 返回脱敏的 Key（只显示最后 4 位）
  const safeKeys = keys.map((k) => {
    let masked = "****";
    try {
      masked = `sk-****${k.id.slice(-4)}`;
    } catch {}

    return {
      id: k.id,
      provider: k.provider,
      format: k.format,      
      label: k.label,
      baseUrl: k.baseUrl,
      isActive: k.isActive,
      maskedKey: masked,
      createdAt: k.createdAt,
      models: k.models, // 传回前端
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

  try {
    const { apiKey, label, baseUrl, models } = parsed.data;

    // 加密 API Key
    const { encrypted, iv } = encrypt(apiKey);

    // 格式化模型以满足数据库中的 models 字段结构
    const formattedModels: Prisma.InputJsonValue = models.map((m) => ({
      id: m.id,
      name: m.name,
      inputPrice: 0,
      outputPrice: 0,
    }));

    const key = await db.apiKey.create({
      data: {
        userId: session.user.id,
        provider: "openai", // 统一存为 "openai" 兼容提供商
        format: "openai",
        encryptedKey: encrypted,
        iv,
        label: label || "OpenAI 兼容密钥",
        baseUrl: baseUrl || null,
        models: formattedModels,
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
  } catch (error) {
    if (isEncryptionConfigError(error)) {
      return Response.json(
        {
          error:
            "Server encryption is not configured. Set ENCRYPTION_KEY to a 64-character hex string, then restart the app.",
          code: "ENCRYPTION_CONFIG_ERROR",
        },
        { status: 503 }
      );
    }

    console.error("Failed to create API key", error);
    return Response.json(
      { error: "Failed to save API key", code: "API_KEY_SAVE_FAILED" },
      { status: 500 }
    );
  }
}
