import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { RecommendationAction, RecommendationStatus } from "@prisma/client";

// Zod 人工审核校验 Schema
const createReviewSchema = z.object({
  action: z.nativeEnum(RecommendationAction),
  modifiedContent: z.string().max(2000, "修改后的内容过长").optional().nullable(),
  feedbackReason: z.string().max(500, "反馈缘由过长").optional().nullable(),
});

/**
 * POST /api/recommendations/[id]/review
 * 提交销售人员对 AI 建议的采纳/修改/驳回/忽略或转交动作，完成人机闭环回写
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;
    const { id: recommendationId } = await params;

    // 1. Zod 请求体校验
    const body = await validateBody(createReviewSchema, req);

    // 2. 检查该建议是否存在且属于当前用户的组织
    const recommendation = await db.recommendation.findFirst({
      where: {
        id: recommendationId,
        customer: {
          organization: { userId }, // 组织安全防护隔离
        },
      },
    });

    if (!recommendation) {
      return apiError("AI 智能建议记录不存在或无权审核", 404);
    }

    // 3. 将审批 Action 转换为 Recommendation 数据库状态
    let newStatus: RecommendationStatus = recommendation.status;
    let isEscalated = recommendation.isEscalated;

    switch (body.action) {
      case RecommendationAction.APPROVE:
        newStatus = RecommendationStatus.APPROVED;
        break;
      case RecommendationAction.REJECT:
        newStatus = RecommendationStatus.REJECTED;
        break;
      case RecommendationAction.DISMISS:
        newStatus = RecommendationStatus.DISMISSED;
        break;
      case RecommendationAction.ESCALATE:
        // 转人工/主管介入，状态可保持 pending 且将 isEscalated 设为 true
        isEscalated = true;
        break;
    }

    // 4. 使用 Prisma 事务 (Transaction) 确保人机闭环数据的一致性
    const result = await db.$transaction(async (tx) => {
      // (a) 创建人工审核日志
      const review = await tx.humanReview.create({
        data: {
          recommendationId,
          userId,
          action: body.action,
          modifiedContent: body.modifiedContent,
          feedbackReason: body.feedbackReason,
        },
      });

      // (b) 更新智能建议状态
      const updatedRec = await tx.recommendation.update({
        where: { id: recommendationId },
        data: {
          status: newStatus,
          isEscalated,
        },
      });

      // (c) 如果是采纳 (APPROVE)，可以记录或模拟 ROI 节省时间 (Outcome)，并自动写入时间轴跟进足迹，消除漏跟进警告！
      if (body.action === RecommendationAction.APPROVE) {
        // 自动评估节省的销售整理工时：AI 生成 360 画像和草稿平均节省 15 分钟 (0.25 小时)
        await tx.outcome.create({
          data: {
            customerId: recommendation.customerId,
            stage: "OPPORTUNITY", // 默认采纳阶段为商机推进
            savedHours: 0.25,      // 节省 0.25 小时
            feedback: `采纳 AI 智能跟进建议与邮件话术: ${body.modifiedContent || "保留原版草稿"}`,
          },
        });

        // 自动往沟通纪要(Interaction)里写入一条新记录，让时间轴立刻刷新展现采纳结果！
        const rawContent = body.modifiedContent || updatedRec.talkTrack || updatedRec.nextAction;
        const interactionType = updatedRec.nextAction.includes("电话") ? "CALL" : "EMAIL";
        await tx.interaction.create({
          data: {
            customerId: recommendation.customerId,
            type: interactionType,
            content: `[已采纳 AI 销售SOP建议并发起跟进]\n跟进话术内容：\n${rawContent}`,
            summary: `销售采纳了 AI SOP 建议并发起了沟通。系统已自动进行工时抵扣(0.25小时)与ROI沉淀。`,
            contactDate: new Date(),
          }
        });

        // 自动消除可能存在的“漏跟进/未跟进”预警信号
        await tx.customerSignal.updateMany({
          where: {
            customerId: recommendation.customerId,
            type: "no_followup",
            isResolved: false
          },
          data: {
            isResolved: true,
            resolvedAt: new Date()
          }
        });
      }

      return { review, updatedRec };
    });

    return apiResponse(result);
  } catch (error: any) {
    console.error(`[POST /api/recommendations/[id]/review] 失败: ${error.message}`, error);
    return apiError(error.message || "提交审核操作失败", 500);
  }
}
