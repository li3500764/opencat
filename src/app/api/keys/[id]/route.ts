// ============================================================
// API Key — 删除 + 测试 + 编辑
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { createModel } from "@/lib/llm";
import { generateText } from "ai";

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

// PUT — 编辑 API Key（label / baseUrl / provider / apiKey 都可改）
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
  const { label, baseUrl, provider, apiKey: newApiKey, format } = body as {
    label?: string;
    baseUrl?: string;
    provider?: string;
    apiKey?: string;
    format?: string;      // ★ API 协议格式
  };

  // 构建更新数据
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (label !== undefined) updateData.label = label;
  if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
  if (provider !== undefined) updateData.provider = provider;
  if (format !== undefined) updateData.format = format;    // ★ 更新 API 格式

  // 如果传了新的 API Key，重新加密
  if (newApiKey && newApiKey.trim()) {
    const { encrypted, iv } = encrypt(newApiKey.trim());
    updateData.encryptedKey = encrypted;
    updateData.iv = iv;
    // 更新 maskedKey：显示前 4 位和后 4 位
    updateData.maskedKey =
      newApiKey.slice(0, 4) + "..." + newApiKey.slice(-4);
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

  // 动态生成 maskedKey（和 GET /api/keys 保持一致）
  const decryptedKey = decrypt(updated.encryptedKey, updateData.iv ?? key.iv);
  return Response.json({
    ...updated,
    encryptedKey: undefined,
    maskedKey: decryptedKey.slice(0, 4) + "..." + decryptedKey.slice(-4),
  });
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

    // 选一个小模型测试
    const testModelMap: Record<string, string> = {
      openai: "gpt-5.4-nano",
      anthropic: "claude-3-5-haiku-20241022",
      deepseek: "deepseek-chat",
      google: "gemini-3-flash",
    };
    const testModel = testModelMap[key.provider] || "gpt-5.4-nano";

    const model = createModel(testModel, apiKey, {
      baseUrl: key.baseUrl || undefined,
      providerId: key.provider === "custom" ? "custom" : undefined,
      format: (key.format as "openai" | "openai-responses" | "anthropic" | "google-genai") || undefined,
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
