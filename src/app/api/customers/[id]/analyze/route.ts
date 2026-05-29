// ============================================================
// POST /api/customers/[id]/analyze
// CRI 智能分析诊断 API 路由 (Day 10 重构版)
// ============================================================
//
// 职责：
//   1. 进行身份与组织安全隔离校验。
//   2. 调用底层的 analyzeCustomerContext 智能中枢进行实时 RAG 知识库检索与大模型强类型输出。
//   3. 使用 Prisma 数据库事务原子性地更新建议状态，并智能生成流失预警 (churn_risk) 或漏跟进警告 (no_followup)。
//   4. 封装健壮响应与全局异常捕获。
//
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError } from "@/lib/api-utils";
import { analyzeCustomerContext } from "@/lib/cri/analyzer";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 鉴权与身份识别
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;
    const { id: customerId } = await params;

    // 2. 获取该客户信息，确保属于当前用户的组织 (组织安全隔离)
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        organization: { userId },
      },
    });

    if (!customer) {
      return apiError("未找到该客户实体或无权执行诊断分析", 404);
    }

    // 3. 调用底层的 AI 分析引擎 (整合 360 度立体上下文 & RAG 销售 SOP)
    const analysisResult = await analyzeCustomerContext(customerId, userId);

    const { intentScore, riskReason, nextAction, talkTrack, evidence } = analysisResult;

    // 4. 开启 Prisma 事务，原子化地写入 Recommendation 并触发潜在 CustomerSignal
    const recommendation = await db.$transaction(async (tx) => {
      // (a) 将该客户之前所有未处理的 PENDING 建议标记为 DISMISSED (归档历史建议)
      await tx.recommendation.updateMany({
        where: { customerId, status: "PENDING" },
        data: { status: "DISMISSED" },
      });

      // (b) 创建全新生成的智能建议记录
      const rec = await tx.recommendation.create({
        data: {
          customerId,
          intentScore,
          riskReason,
          nextAction,
          talkTrack,
          evidence: evidence, // 直接传入数组，Prisma 会根据 json 字段自动转存
          status: "PENDING",
        },
      });

      // (c) 智能预警机制 1：如果大模型判定为 at-risk (高流失风险)，且尚未建立该信号，自动创建 CRITICAL 预警
      if (intentScore === "at-risk") {
        const hasRiskSignal = await tx.customerSignal.findFirst({
          where: { customerId, type: "churn_risk", isResolved: false },
        });

        if (!hasRiskSignal) {
          await tx.customerSignal.create({
            data: {
              customerId,
              type: "churn_risk",
              level: "CRITICAL",
              description: `AI 诊断该客户处于高流失风险 (at-risk) 状态。潜在异动诱因: ${riskReason || "沟通活跃度骤降或提及竞争对手，跟进可能出现阻碍。"}`,
              isResolved: false,
            },
          });
        }
      }

      // (d) 智能预警机制 2：如果属于线索 (LEAD) 阶段且入库过久没有新建销售交互，则自动抛出漏跟进警告
      if (customer.stage === "LEAD") {
        // 计算跟进记录总数
        const interactionCount = await tx.interaction.count({
          where: { customerId },
        });

        if (interactionCount === 0) {
          const hasFollowupSignal = await tx.customerSignal.findFirst({
            where: { customerId, type: "no_followup", isResolved: false },
          });

          if (!hasFollowupSignal) {
            await tx.customerSignal.create({
              data: {
                customerId,
                type: "no_followup",
                level: "WARNING",
                description: "该线索已入库但尚未建立任何有效沟通。SLA 超时，请根据 SOP 指引尽快发起首轮跟进。",
                isResolved: false,
              },
            });
          }
        }
      }

      return rec;
    });

    // 5. 采用强校验的 apiResponse 成功返回
    return apiResponse(recommendation, 201);
  } catch (error: any) {
    console.error(`[POST /api/customers/[id]/analyze] 诊断分析接口失败: ${error.message}`, error);
    
    // 全局异常捕获，若底层的 API Key 未配或 LLM 超时，优雅提示给前端
    return apiError(
      error.message || "AI 智能诊断引擎发生内部错误，请稍后重试",
      error.message?.includes("API Key") ? 400 : 500
    );
  }
}
