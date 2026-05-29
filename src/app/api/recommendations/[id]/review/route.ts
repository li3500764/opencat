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

      // (c) 如果是采纳 (APPROVE)，可以记录或模拟 ROI 节省时间 (Outcome)
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
      }

      return { review, updatedRec };
    });

    return apiResponse(result);
  } catch (error: any) {
    console.error(`[POST /api/recommendations/[id]/review] 失败: ${error.message}`, error);
    return apiError(error.message || "提交审核操作失败", 500);
  }
}
