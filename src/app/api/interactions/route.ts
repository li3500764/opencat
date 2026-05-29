import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { InteractionType } from "@prisma/client";

// 创建沟通记录 Zod 校验 Schema
const createInteractionSchema = z.object({
  customerId: z.string().min(1, "客户ID不能为空"),
  type: z.nativeEnum(InteractionType).optional().default(InteractionType.NOTE),
  content: z.string().min(1, "沟通详细内容不能为空"),
  summary: z.string().optional().nullable(),
  contactDate: z.string().datetime({ message: "沟通发生时间应为合法 ISO 时间格式" })
    .transform((str) => new Date(str))
    .optional(),
});

/**
 * GET /api/interactions
 * 获取与筛选沟通历史记录列表
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 解析查询参数
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    // 构建查询条件
    const whereClause: any = {
      customer: {
        organization: { userId }, // 组织安全隔离
      },
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    // 执行查询
    const interactions = await db.interaction.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true },
        },
      },
      orderBy: { contactDate: "desc" }, // 沟通时间倒序
    });

    return apiResponse(interactions);
  } catch (error: any) {
    console.error("[GET /api/interactions] 失败:", error);
    return apiError(error.message || "获取沟通记录失败", 500);
  }
}

/**
 * POST /api/interactions
 * 新增客户的沟通历史记录
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 1. Zod 校验
    const body = await validateBody(createInteractionSchema, req);

    // 2. 验证客户主体归属权
    const customerExists = await db.customer.findFirst({
      where: {
        id: body.customerId,
        organization: { userId },
      },
    });

    if (!customerExists) {
      return apiError("客户主体不存在或无权访问", 400);
    }

    // 3. 写入数据库
    const interaction = await db.interaction.create({
      data: {
        customerId: body.customerId,
        type: body.type,
        content: body.content,
        summary: body.summary,
        contactDate: body.contactDate || new Date(), // 如果未传时间，默认当前时间
      },
    });

    // 4. 更新客户的 updatedAt，反映最新互动状态
    await db.customer.update({
      where: { id: body.customerId },
      data: { updatedAt: new Date() },
    });

    return apiResponse(interaction, 201);
  } catch (error: any) {
    console.error("[POST /api/interactions] 失败:", error);
    return apiError(error.message || "创建沟通记录失败", 500);
  }
}
