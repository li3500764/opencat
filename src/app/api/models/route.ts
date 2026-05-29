// ============================================================
// Models API — 获取用户所有可用模型
// ============================================================
//
// Day 8 新增：
// 聚合用户所有 Provider 配置下的模型，返回扁平的 UserModelInfo[] 列表。
// 前端的 ModelSelector 从这里获取数据，而不是从硬编码的 PROVIDERS 数组。
//
// 数据流：
//   ApiKey 表（每条记录一个 Provider）
//     → 读取 models JSON 字段（模型数组）
//     → 展开为 UserModelInfo[]（带上 Provider 信息）
//     → 返回给前端
//
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import type { ModelInfo, UserModelInfo, ApiFormat } from "@/lib/llm";

// GET — 获取当前用户所有可用的模型列表
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 查询用户的所有 Provider 配置
  const providers = await db.apiKey.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      format: true,
      baseUrl: true,
      models: true,  // ★ Day 8 新增的 JSON 字段
    },
  });

  // 展开为扁平的模型列表
  const allModels: UserModelInfo[] = [];

  for (const provider of providers) {
    // models 字段是 JSON，需要安全解析
    const models = (provider.models as ModelInfo[]) || [];

    for (const model of models) {
      allModels.push({
        id: model.id,
        name: model.name,
        providerId: provider.id,
        providerLabel: provider.label,
        format: provider.format as ApiFormat,
        inputPrice: model.inputPrice ?? 0,
        outputPrice: model.outputPrice ?? 0,
      });
    }
  }

  return Response.json(allModels);
}
