import { generateText } from "ai";
import type { ApiKey } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import { calculateCost, createModel, getProviderForModel, type ApiFormat, type ModelInfo } from "@/lib/llm";
import { db } from "@/server/db";
import type { BaziChart, FortuneCompositeChart, FortuneInput } from "./types";

export interface FortuneModelConfig {
  modelId: string;
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  format?: ApiFormat;
}

export async function resolveFortuneModelConfig(userId: string, modelId: string): Promise<FortuneModelConfig> {
  const staticProviderId = getProviderForModel(modelId);
  let providerId = staticProviderId || "openai";
  let userKey: ApiKey | null = null;

  if (!staticProviderId) {
    const activeKeys = await db.apiKey.findMany({
      where: { userId, isActive: true },
    });
    const matchedKey = activeKeys.find((key) => {
      const models = (key.models as unknown as ModelInfo[]) || [];
      return models.some((model) => model.id === modelId);
    });
    if (matchedKey) {
      userKey = matchedKey;
      providerId = matchedKey.provider;
    }
  }

  if (!userKey) {
    userKey = await db.apiKey.findFirst({
      where: { userId, provider: providerId, isActive: true },
    });
  }

  if (!userKey && providerId !== "custom") {
    userKey = await db.apiKey.findFirst({
      where: { userId, provider: "custom", isActive: true },
    });
  }

  if (!userKey) {
    userKey = await db.apiKey.findFirst({
      where: { userId, isActive: true },
    });
    if (userKey) providerId = userKey.provider;
  }

  if (userKey) {
    return {
      modelId,
      providerId,
      apiKey: decrypt(userKey.encryptedKey, userKey.iv),
      baseUrl: userKey.baseUrl || undefined,
      format: userKey.format as ApiFormat | undefined,
    };
  }

  const envKeyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
  const envKey = envKeyMap[providerId] || process.env.OPENAI_API_KEY;
  if (!envKey) {
    throw new Error(`No API key found for model "${modelId}". Add one in Settings → API Keys.`);
  }

  return {
    modelId,
    providerId,
    apiKey: envKey,
  };
}

export function buildFortuneSystemPrompt() {
  return `你是 OpenCat 的术数解读助手。你必须遵守以下硬性规则：
1. 不得自行重新排盘、起卦或抽牌，不得修改四柱、干支、十神、大运、流年、神煞、紫微十二宫、星曜、卦象、塔罗牌等字段。
2. 只能基于用户传入的 chart JSON 做解释；如果字段不足，必须说明限制。
3. 不得声称结果绝对准确，不得提供医疗、法律、投资、婚姻等重大决策指令。
4. 用中文输出，语气克制、具体、有依据，引用程序排盘字段。
5. 结果用于文化娱乐、个人反思和传统术数研究参考。`;
}

export function buildFortuneUserPrompt(input: FortuneInput, chart: BaziChart, compositeChart?: FortuneCompositeChart) {
  const payload = compositeChart || { bazi: chart };
  return `请基于以下由程序确定性排出的四柱八字命盘、紫微斗数星盘、周易时间卦与塔罗牌阵做解读。不要重新计算命盘、卦象或重新抽牌。

【用户输入】
姓名：${input.profileName}
性别：${input.gender}
出生地区：${input.birthLocation.name}
出生时间口径：${chart.calculationBasis.timeBasis}
测算时间：${chart.calculationBasis.queryDateTimeLocal}

【程序排盘 JSON】
${JSON.stringify(payload, null, 2)}

请按以下结构输出：
一、命盘摘要
二、日主与五行
三、十神结构
四、格局、旺衰与用神倾向
五、大运与流年提示
六、紫微斗数提示（命宫、身宫、命主身主、五行局、重点宫位星曜）
七、周易时间卦提示（本卦、动爻、互卦、变卦）
八、塔罗三张牌提示（牌位、牌名、正逆位、关键词）
九、事业、财务、关系、健康倾向
十、注意事项与免责声明`;
}

export async function generateFortuneInterpretation(
  userId: string,
  input: FortuneInput,
  chart: BaziChart,
  compositeChart?: FortuneCompositeChart
) {
  const config = await resolveFortuneModelConfig(userId, input.modelId);
  const model = createModel(config.modelId, config.apiKey, {
    baseUrl: config.baseUrl,
    providerId: config.providerId,
    format: config.format,
  });
  const result = await generateText({
    model,
    system: buildFortuneSystemPrompt(),
    prompt: buildFortuneUserPrompt(input, chart, compositeChart),
  });
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;
  const totalTokens = result.usage?.totalTokens ?? inputTokens + outputTokens;
  return {
    text: result.text.trim(),
    modelId: config.modelId,
    providerId: config.providerId,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens,
    cost: calculateCost(config.modelId, inputTokens, outputTokens),
  };
}
