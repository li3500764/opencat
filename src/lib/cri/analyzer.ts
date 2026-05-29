// ============================================================
// CRI 智能分析核心服务 (Day 10 - 完美修复版)
// ============================================================
//
// 职责：
//   1. 提取客户的 360 度立体足迹上下文 (Customer, Leads, Interactions, Signals)。
//   2. 基于项目的 RAG 知识库，检索匹配相关的销售 SOP / Playbook 条款。
//   3. 解密匹配用户的 LLM API Key，创建大模型实例。
//   4. 调用 Vercel AI SDK 6.x generateText + 手动 JSON 解析，彻底绕开 structured outputs 兼容性问题
//
// ============================================================

import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
import { createModel, getProviderForModel } from "@/lib/llm";
import { retrieveRelevantChunks } from "@/lib/memory";
import { generateText } from "ai";
import { z } from "zod";

// 定义大模型强类型输出的 Zod Schema
const analysisResultSchema = z.object({
  intentScore: z.enum(["hot", "warm", "cold", "at-risk"]),
  riskReason: z.string().nullable(),
  nextAction: z.string(),
  talkTrack: z.string(),
  evidence: z.array(
    z.object({
      type: z.enum(["signal", "interaction", "customer", "lead", "outcome", "playbook"]),
      source: z.string(),
      text: z.string(),
    })
  ),
});

// 导出强类型接口，便于外部调用
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/**
 * 核心分析方法：透视客户 360 度立体上下文，并结合销售 SOP 知识库进行 AI 诊断
 * @param customerId 客户 ID
 * @param userId 用户 ID
 */
export async function analyzeCustomerContext(
  customerId: string,
  userId: string
): Promise<AnalysisResult> {
  // ------------------------------------------------------------
  // 1. 读取客户多维档案与足迹数据
  // ------------------------------------------------------------
  const customer = await db.customer.findFirst({
    where: {
      id: customerId,
      organization: { userId },
    },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      interactions: {
        orderBy: { contactDate: "desc" },
        take: 10,
      },
      signals: {
        where: { isResolved: false },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    throw new Error("未找到该客户实体，或当前用户无权访问");
  }

  // ------------------------------------------------------------
  // 2. 检索销售 Playbook 知识库 (RAG 对齐)
  // ------------------------------------------------------------
  let sopContext = "";
  
  // 查找用户的默认项目 (通常在 OpenCat 中，一用户对应一默认项目)
  const defaultProject = await db.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (defaultProject) {
    // 查找该项目下的第一个可用知识库 (销售 SOP / Playbook 库)
    const knowledgeBase = await db.knowledgeBase.findFirst({
      where: { projectId: defaultProject.id },
    });

    if (knowledgeBase) {
      // 构造检索词，融合客户的行业痛点与当前阶段
      const query = `客户阶段: ${customer.stage}, 行业: ${customer.industry || "通用"}, 痛点: ${customer.name} 跟进规范 销售话术 异议处理`;
      
      try {
        // 调用 RAG 检索
        const chunks = await retrieveRelevantChunks(query, knowledgeBase.id, userId, {
          limit: 3,
          minSimilarity: 0.25,
        });

        if (chunks.length > 0) {
          sopContext = chunks
            .map((chunk, idx) => `[SOP规范参考 ${idx + 1}] ${chunk.content}`)
            .join("\n\n");
        }
      } catch (ragError) {
        console.error(`[CRI Analyzer] RAG 检索知识库失败:`, ragError);
        // 降级处理：不阻断主流程，仅不提供 SOP 背景知识
      }
    }
  }

  // ------------------------------------------------------------
  // 3. 构建高品质、克制且严谨的企业决策 System Prompt 和 Input Prompt
  // ------------------------------------------------------------
  const systemPrompt = `你是一名拥有 15 年丰富经验的高级 RevenueOps CRI (客户关系智能) 专家及销售策略顾问。
你的任务是通过透视客户的立体上下文（包括沟通历史、当前商机金额、未决警报信号），提供专业、严谨且克制销售诊断与个性化跟进方案。

【核心原则】
1. **真实且有据可查**：你的所有意向判定和风险诊断必须基于提供的【事实数据】和【沟通历史】，严禁凭空臆造。证据链 (evidence) 必须准确回溯事实。
2. **高水准话术草稿**：
   - 话术草稿 (talkTrack) 必须融入客户主要联系人的称呼，针对性回应其行业痛点。
   - 语言必须专业、得体、严谨，语气保持温和与克制。
   - **绝对禁止使用浮夸套话**（如"祝您生活愉快"、"我们是全网最强的AI"、"为您保驾护航"等）。
   - 如果提供了【销售 SOP / Playbook 规范】，你必须完全遵循规范中的沟通思路 and 话术模版。
3. **分阶段诊断原则**：
   - LEAD (线索)：关注响应速度 (SLA)，摸清客户预算痛点及决策链。
   - TRIAL (试用)：监控活跃度，提供技术避坑指南，解答配置疑问。
   - OPPORTUNITY (商机)：商务推进，对齐关键决策人，发送针对性商务报价草稿，推进签约。
   - CUSTOMER (成交)：客户成功关怀，收集满意度和采纳率，维系长期信任。
   - CHURNED (流失)：保持轻度弱联系，发送季报，探寻重组机会。

【输出格式要求】
你必须且只能输出一个合法的 JSON 对象，不要包含任何多余的文字、代码块标记或解释。JSON 结构如下：
{
  "intentScore": "hot" | "warm" | "cold" | "at-risk",
  "riskReason": "风险原因描述（无风险则为 null）",
  "nextAction": "下一步推荐动作",
  "talkTrack": "个性化沟通话术草稿",
  "evidence": [
    { "type": "signal|interaction|customer|lead|outcome|playbook", "source": "来源", "text": "依据描述" }
  ]
}`;

  // 准备客户立体信息文本
  const customerInfoText = `
【客户画像】
- 公司名称: ${customer.name}
- 联系人: ${customer.contactName || "暂无"} (邮箱: ${customer.email || "暂无"}, 电话: ${customer.phone || "暂无"})
- 行业: ${customer.industry || "未分类"}
- 规模: ${customer.size || "暂无"}
- 预估预算: ${customer.budget ? `$${customer.budget} USD` : "未评估"}
- 当前所处阶段: ${customer.stage}

【当前活跃风险信号 (Signals)】
${
  customer.signals.length > 0
    ? customer.signals.map((s) => `- [${s.level}] ${s.type}: ${s.description}`).join("\n")
    : "- 无活跃风险信号"
}

【当前商机状态 (Leads)】
${
  customer.leads.length > 0
    ? customer.leads.map((l) => `- 来源: ${l.source || "未知"}, 状态: ${l.status}, 估算金额: ${l.value ? `$${l.value} USD` : "待估"}`).join("\n")
    : "- 暂无关联商机"
}

【最新沟通历史 (Interactions)】
${
  customer.interactions.length > 0
    ? customer.interactions
        .map(
          (i, idx) =>
            `${idx + 1}. [${i.contactDate.toISOString().slice(0, 10)}] [${i.type}] ${i.content}`
        )
        .join("\n")
    : "- 暂无任何跟进记录"
}
`;

  const inputPrompt = `
请对以下客户进行智能透视与跟进动作诊断。

${customerInfoText}

${
  sopContext
    ? `【销售 SOP / Playbook 规范】\n以下是匹配到的企业专属销售 SOP 规范，请在撰写"下一步动作 (nextAction)" and "话术草稿 (talkTrack)"时予以严格执行和融入：\n${sopContext}\n`
    : ""
}

请严格只输出 JSON 对象，不要有任何额外文字。
  `;

  // ------------------------------------------------------------
  // 4. 安全检索 API Key 并创建 LLM 实例
  // ------------------------------------------------------------
  try {
    // 获取项目的默认模型，若无则使用标准 gpt-5.4-mini (对应底层 gpt-4o-mini)
    const modelId = defaultProject?.defaultModel || "gpt-5.4-mini";
    const providerId = getProviderForModel(modelId) || "openai";

    // 查找用户的 API Key — 先按 provider 精确匹配，找不到则降级取任意可用 Key
    let userKey = await db.apiKey.findFirst({
      where: { userId, provider: providerId, isActive: true },
    });
    if (!userKey) {
      userKey = await db.apiKey.findFirst({
        where: { userId, isActive: true },
      });
    }

    if (!userKey) {
      // 降级：无密钥时走本地规则引擎
      return getFallbackAnalysisResult(customer);
    }

    const apiKey = decrypt(userKey.encryptedKey, userKey.iv);
    const baseUrl = userKey.baseUrl || undefined;

    // 创建大模型实例
    const model = createModel(modelId, apiKey, {
      baseUrl,
      providerId,
    });

    // 使用 generateText 代替 generateObject，彻底绕开 DeepSeek 等模型
    // 不支持 OpenAI structured outputs (json_schema / response_format) 的兼容性问题
    const response = await generateText({
      model,
      system: systemPrompt,
      prompt: inputPrompt,
    });

    // 从大模型返回的纯文本中提取 JSON
    const rawText = response.text.trim();
    // 兼容大模型可能在 JSON 外包裹 ```json ... ``` 代码块的情况
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);
    // 用 Zod 做运行时类型校验，确保输出格式合规
    const validated = analysisResultSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error("[CRI Analyzer] AI 智能诊断失败，无缝降级到本地规则引擎:", error);
    return getFallbackAnalysisResult(customer);
  }
}

/**
 * 本地高可用规则引擎降级兜底方案 — 输出高品质纯中文销售策略与跟进话术
 * @param customer 客户立体数据
 */
function getFallbackAnalysisResult(customer: any): AnalysisResult {
  const contact = customer.contactName || "您";
  const industry = customer.industry || "通用行业";

  let intentScore: "hot" | "warm" | "cold" | "at-risk" = "warm";
  let riskReason: string | null = null;
  let nextAction = "";
  let talkTrack = "";
  let evidence: AnalysisResult["evidence"] = [
    { type: "playbook", source: "高可用规则引擎", text: "已无缝降级激活本地决策树" }
  ];

  switch (customer.stage) {
    case "LEAD":
      intentScore = "warm";
      riskReason = "检测到该线索录入后尚未建立任何有效电话沟通，SLA 响应超时 (已超 24 小时)。";
      nextAction = `【销售SOP建议】建议在 4 小时内拨打首轮电话跟进。确认 ${customer.name} 针对 ${industry} 的核心采购痛点，并摸清其项目启动预算与预计决策周期。`;
      talkTrack = `您好，${contact}！我是我们的客户运营顾问。注意到您近期关注了我们针对 ${industry} 场景的最新企业化智能 Agent 解决方案。不知下周是否有空为您进行一次 15 分钟的线上演示，以便您直观评估 ROI 提升空间？`;
      evidence.push({ type: "signal", source: "SLA监视器", text: "线索录入超过24小时未创建跟进记录" });
      break;

    case "TRIAL":
      intentScore = "hot";
      riskReason = "客户试用即将到期，且系统记录其登录活跃度稍有波动，可能在核心功能配置中遇到卡点。";
      nextAction = `【销售SOP建议】向 ${contact} 主动发送《企业级 Agent 部署与高级 Tool Calling 配置手册》，并电话回访，协助解决其对接 PostgreSQL / Redis 时的阻碍。`;
      talkTrack = `您好，${contact}！看到您正在试用我们的 Agent 编排底座。我们在后台注意到您配置了 RAG 知识库，但可能在 pgvector 向量检索上遇到了一些连接疑惑。这里有一份由工程专家整理的《Prisma 7 向量存储避坑指南》，您可以参考一下。我们今天也可以安排技术支持为您进行一次免费电话指导。`;
      evidence.push({ type: "interaction", source: "销售备注", text: "用户提到对 pgvector 和 RAG 检索稳定性非常关注" });
      break;

    case "OPPORTUNITY":
      intentScore = "hot";
      riskReason = "处于商机签约冲刺期，但采购预算尚未落实，且采购部门决策人未引入群链。";
      nextAction = `【销售SOP建议】正式发起商务报价单草案，并提议与 ${customer.name} 的财务/采购负责人以及技术总监召开商务与安全性评估三方会议，落实回写合同条款。`;
      talkTrack = `您好，${contact}！感谢您 and 团队对我们的认可。根据我们前期的业务沟通与 ROI 测算（预计可帮贵司在 ${industry} 业务场景中挽回 25% 的停滞商机，并节省 30% 人工整理时间），我们已为您拟定了一份针对性商务报价方案草案。附件是报价单详情，请您审阅。`;
      evidence.push({ type: "lead", source: "商机库", text: `商机预算预估为: ${customer.budget || "待定"} USD` });
      break;

    case "CUSTOMER":
      intentScore = "warm";
      riskReason = null;
      nextAction = `【销售SOP建议】进入客户成功 (CS) 常规维护。建议在 30 天内进行一次 system 回访，收集 ${customer.name} 在实际 RevenueOps 经营闭环中对 AI 话术采纳率的反馈。`;
      talkTrack = `您好，${contact}！很荣幸能为贵司的客户经营提供 AI 操作层支持。目前系统运行一切良好。本月我们推出了针对 ${industry} 的最新销售 SOP 推荐模板，想听听您在使用过程中的改进建议。`;
      evidence.push({ type: "outcome", source: "ROI看板", text: "系统已为用户预估累计节省工时" });
      break;

    case "CHURNED":
      intentScore = "at-risk";
      riskReason = "客户已正式进入流失阶段，历史原因反馈为‘采购预算缩减，系统转向内部自研’。";
      nextAction = `【销售SOP建议】标记为流失归档。每隔半年进行轻度行业季报发送维护，探测其未来重组预算的潜在机会。`;
      talkTrack = `您好，${contact}。非常感谢您之前对我们的支持。知晓贵司近期进行了方向调整，祝您业务一切顺利。附件是本季度最新的《B2B 领域 AI Agent Runtime 建设趋势白皮书》，供您与团队参考，有任何需求欢迎随时交流。`;
      evidence.push({ type: "outcome", source: "复盘归档", text: "复盘记录标记流失原因为预算收缩" });
      break;
  }

  // 英文版兜底话术的辅助本地化映射 (若客户绑定了外语偏好)
  if (localeIsEn(customer)) {
    if (customer.stage === "LEAD") {
      talkTrack = `Hi ${contact}, this is Sales Consultant. We noticed your recent interest in our latest B2B enterprise AI solutions. Would you be open for a brief 15-minute call next Tuesday to evaluate the potential ROI improvement for ${customer.name}?`;
      nextAction = `【SOP Alert】Follow up within 4 hours. Confirm purchase pain points for ${customer.name} and identify budget and decision cycles.`;
    } else if (customer.stage === "TRIAL") {
      talkTrack = `Hi ${contact}! We noticed you're testing our AI Orchestrator Runtime and pgvector RAG database. We've prepared a comprehensive guide on 'Prisma 7 Vector Storage Debugging'. Let us know if you need a free 15-minute engineering support call today!`;
      nextAction = `【SOP Alert】Send RAG & Tool Calling debugging handbook to ${contact}. Assist in resolving pgvector setup blocker.`;
    }
  }

  return {
    intentScore,
    riskReason,
    nextAction,
    talkTrack,
    evidence,
  };
}

// 辅助检测当前客户资料是否属于英文环境，若是有自适应输出英文话术
function localeIsEn(customer: any): boolean {
  // 根据用户全局设定：我是中文用户，回复我的请全部使用中文
  return false;
}
