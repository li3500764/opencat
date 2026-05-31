// ============================================================
// API Key — 删除 + 测试 + 编辑
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { classifyDatabaseError } from "@/server/db/errors";
import { decrypt, encrypt, isEncryptionConfigError } from "@/lib/crypto";
import { createModel } from "@/lib/llm";
import type { Prisma } from "@prisma/client";
import { generateText } from "ai";
import { z } from "zod/v4";

const updateKeySchema = z.object({
  label: z.string().trim().optional(),
  baseUrl: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  models: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
      })
    )
    .optional(),
});

// DELETE — 删除指定的 API Key
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 校验所有权
  const key = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id } });
  return Response.json({ success: true });
}

// PUT — 编辑 API Key（label / baseUrl / models / apiKey 都可改）
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 校验所有权
  const key = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateKeySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { label, baseUrl, apiKey: newApiKey, models } = parsed.data;

  const updateData: Prisma.ApiKeyUpdateInput = {};
  let updatedIv = key.iv;

  if (label !== undefined) updateData.label = label;
  if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
  updateData.provider = "openai";
  updateData.format = "openai";

  if (models !== undefined) {
    updateData.models = models.map((m) => ({
      id: m.id,
      name: m.name,
      inputPrice: 0,
      outputPrice: 0,
    }));
  }

  try {
    // 如果传了新的 API Key，重新加密
    if (newApiKey) {
      const { encrypted, iv } = encrypt(newApiKey);
      updateData.encryptedKey = encrypted;
      updateData.iv = iv;
      updatedIv = iv;
    }

    const updated = await db.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        provider: true,
        label: true,
        baseUrl: true,
        isActive: true,
        encryptedKey: true,
        createdAt: true,
      },
    });

    // 动态生成 maskedKey
    const decryptedKey = decrypt(updated.encryptedKey, updatedIv);
    return Response.json({
      ...updated,
      encryptedKey: undefined,
      maskedKey: decryptedKey.slice(0, 4) + "..." + decryptedKey.slice(-4),
    });
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

    const databaseError = classifyDatabaseError(error);
    if (databaseError) {
      console.error("Failed to update API key", error);
      return Response.json(
        { error: databaseError.message, code: databaseError.code },
        { status: databaseError.status }
      );
    }

    console.error("Failed to update API key", error);
    return Response.json(
      { error: "Failed to update API key", code: "API_KEY_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

// POST — 测试 API Key 是否可用
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const key = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // 解密 API Key
    const apiKey = decrypt(key.encryptedKey, key.iv);

    // 优先从配置的模型中选择第一个进行测试，否则使用 gpt-4o-mini
    let testModel = "gpt-4o-mini";
    const models = (key.models as unknown as { id: string }[]) || [];
    if (models.length > 0 && models[0]?.id) {
      testModel = models[0].id;
    }

    const model = createModel(testModel, apiKey, {
      baseUrl: key.baseUrl || undefined,
      format: "openai",
    });

    // 发一个极短的测试请求
    const result = await generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 5,
    });

    return Response.json({
      success: true,
      message: `Key is valid. Response: "${result.text.slice(0, 50)}"`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, message: `Key test failed: ${message}` },
      { status: 400 }
    );
  }
}
