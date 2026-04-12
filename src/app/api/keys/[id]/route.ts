// ============================================================
// API Key — 删除 + 测试
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
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
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-haiku-20241022",
      deepseek: "deepseek-chat",
    };
    const testModel = testModelMap[key.provider] || "gpt-4o-mini";

    const model = createModel(testModel, apiKey, {
      baseUrl: key.baseUrl || undefined,
      providerId: key.provider === "custom" ? "custom" : undefined,
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
