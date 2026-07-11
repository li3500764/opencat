import type { ApiKey } from "@prisma/client";
import { decrypt } from "../crypto";
import { calculateCost, createModel, getProviderForModel, type ApiFormat, type ModelInfo } from "../llm";
import { db } from "../../server/db";
import { generateCompleteFortuneText } from "./complete-text";
import type { FortuneInput, FortuneMethod } from "./types";

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
  return `你是 OpenCat 搭载的专业命理分析引擎。你必须遵守以下硬性规则：
1. 不得自行重新排盘、起卦或抽牌，不得修改用户传入的程序结果字段。
2. 只能基于用户选择的单一 method 和传入的 chart JSON 做解释；不得跨体系混合引用其它术数。
3. 如果字段不足，必须说明限制，不得用其它体系补洞。
4. 不得声称结果绝对准确，不得提供医疗、法律、投资、婚姻等重大决策指令。
5. 用中文输出，语言必须极致精炼、犀利、有极强的洞察力。绝不能使用任何网络流行语、套话或浮夸的情绪词。
6. 涉及月份风险比较时，只能使用低、中、高相对风险，并给出支持依据、缓和因素、可信度与现实观察指标。
7. 不得输出单点百分比，不得把术数判断描述为现实统计概率。
8. 结果用于传统文化、个人反思与决策参考。`;
}

function methodName(method: FortuneMethod) {
  const names: Record<FortuneMethod, string> = {
    bazi: "四柱八字",
    ziwei: "紫微斗数",
    zhouyi: "周易时间卦",
    tarot: "塔罗牌阵",
    xiaoliuren: "小六壬",
  };
  return names[method];
}

function methodRules(method: FortuneMethod) {
  switch (method) {
    case "bazi":
      return {
        basis: "出生时间口径",
        sections: "一、命盘摘要\n二、日主与五行\n三、十神结构\n四、格局、旺衰与用神倾向\n五、大运与流年提示\n六、事业、财务、关系、健康倾向\n七、注意事项与免责声明\n八、核心批言（生成一句极简、深刻、直击本质的命理批注，不带任何废话）",
        ban: "不得引用紫微斗数、周易、塔罗等其它体系。",
      };
    case "ziwei":
      return {
        basis: "出生时间口径",
        sections: "一、星盘摘要\n二、命宫、身宫与命主身主\n三、十二宫重点结构\n四、主星、辅星与四化提示\n五、大限与阶段倾向\n六、事业、财务、关系、健康倾向\n七、注意事项与免责声明\n八、核心批言（生成一句极简、深刻、直击本质的命理批注，不带任何废话）",
        ban: "不得引用四柱八字、周易、塔罗等其它体系。",
      };
    case "zhouyi":
      return {
        basis: "起卦时间",
        sections: "一、卦象摘要\n二、本卦结构\n三、动爻提示\n四、互卦与变卦\n五、当前问题的趋势与可调整处\n六、注意事项与免责声明\n七、核心批言（生成一句极简、深刻、直击本质的卦象批注，不带任何废话）",
        ban: "不得引用四柱八字、紫微斗数、塔罗等其它体系。",
      };
    case "tarot":
      return {
        basis: "抽牌时间",
        sections: "一、牌阵摘要\n二、过去牌\n三、现在牌\n四、趋势牌\n五、三张牌之间的张力与提醒\n六、注意事项与免责声明\n七、核心批言（生成一句极简、深刻、直击本质的塔罗批注，不带任何废话）",
        ban: "不得引用四柱八字、紫微斗数、周易等其它体系。",
      };
    case "xiaoliuren":
      return {
        basis: "起卦时间",
        sections: "一、卦象摘要（农历时间、月/日/时三宫落点）\n二、月宫分析（月份落点与当前状态）\n三、日宫分析（日辰落点与事件进展）\n四、时宫分析（时辰落点与最终结果，为三宫之首）\n五、三宫综合判断（月日时三宫的相互作用与趋势）\n六、注意事项与免责声明\n七、核心批言（生成一句极简、深刻、直击本质的小六壬批注，不带任何废话）",
        ban: "不得引用四柱八字、紫微斗数、周易、塔罗等其它体系。",
      };
  }
}

export function buildFortuneUserPrompt(input: FortuneInput, method: FortuneMethod, chart: unknown) {
  const rules = methodRules(method);
  const basisTime = method === "zhouyi" || method === "tarot" || method === "xiaoliuren" ? input.queryDateTimeLocal : input.birthDateTimeLocal;
  return `请基于以下由程序确定性生成的【${methodName(method)}】结果做解读。不要重新计算、重排、重抽，也不要跨体系混合解读。

【硬性边界】
测算方法：${methodName(method)}
${rules.ban}

【用户输入】
姓名：${input.profileName}
性别：${input.gender}
出生地区：${input.birthLocation.name}
${rules.basis}：${basisTime}
测算时间：${input.queryDateTimeLocal}

【程序 JSON】
${JSON.stringify(chart, null, 2)}

请按以下结构输出：
${rules.sections}`;
}

export class FortuneInterpretationTimeoutError extends Error {
  constructor() {
    super("AI 解读超时。程序排盘已完成，请稍后换一个更快的模型重试。");
    this.name = "FortuneInterpretationTimeoutError";
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase().includes("abort") ||
      error.message.toLowerCase().includes("timeout"))
  );
}

export async function generateFortuneInterpretation(
  userId: string,
  input: FortuneInput,
  method: FortuneMethod,
  chart: unknown
) {
  const config = await resolveFortuneModelConfig(userId, input.modelId);
  const model = createModel(config.modelId, config.apiKey, {
    baseUrl: config.baseUrl,
    providerId: config.providerId,
    format: config.format,
  });
  let result: Awaited<ReturnType<typeof generateCompleteFortuneText>>;
  try {
    result = await generateCompleteFortuneText({
      model,
      system: buildFortuneSystemPrompt(),
      prompt: buildFortuneUserPrompt(input, method, chart),
      maxOutputTokens: 4200,
      continuationMaxOutputTokens: 2600,
      maxContinuations: 2,
      timeoutMs: 120_000,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new FortuneInterpretationTimeoutError();
    }
    throw error;
  }
  const inputTokens = result.promptTokens;
  const outputTokens = result.completionTokens;
  const totalTokens = result.totalTokens;
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
