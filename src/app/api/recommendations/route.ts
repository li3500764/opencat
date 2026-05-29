import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError } from "@/lib/api-utils";
import { RecommendationStatus } from "@prisma/client";

/**
 * GET /api/recommendations
 * 获取并筛选 AI 建议列表，支持组织安全隔离
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 解析过滤参数
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status") as RecommendationStatus | null;

    // 构建查询条件
    const whereClause: any = {
      customer: {
        organization: { userId }, // 组织级网络安全防护与隔离
      },
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (status) {
      whereClause.status = status;
    }

    // 查询智能建议列表
    const recommendations = await db.recommendation.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, contactName: true, stage: true },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" }, // 最新生成的建议排在最前面
    });

    return apiResponse(recommendations);
  } catch (error: any) {
    console.error("[GET /api/recommendations] 失败:", error);
    return apiError(error.message || "获取智能建议列表失败", 500);
  }
}
