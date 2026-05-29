import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { LeadStatus } from "@prisma/client";

// 创建线索 Zod 校验 Schema
const createLeadSchema = z.object({
  customerId: z.string().min(1, "客户ID不能为空"),
  source: z.string().max(50, "来源字数过多").optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.NEW),
  value: z.number().nonnegative("线索估算金额不能为负数").optional().nullable(),
});

/**
 * GET /api/leads
 * 获取并筛选销售线索列表
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
    const status = searchParams.get("status") as LeadStatus | null;

    // 构建查询条件
    const whereClause: any = {
      customer: {
        organization: { userId }, // 组织隔离
      },
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (status) {
      whereClause.status = status;
    }

    // 执行查询
    const leads = await db.lead.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, contactName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiResponse(leads);
  } catch (error: any) {
    console.error("[GET /api/leads] 失败:", error);
    return apiError(error.message || "获取线索列表失败", 500);
  }
}

/**
 * POST /api/leads
 * 创建新的销售线索并绑定客户主体
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 1. Zod 校验
    const body = await validateBody(createLeadSchema, req);

    // 2. 检查绑定的客户是否属于该用户的 Organization
    const customerExists = await db.customer.findFirst({
      where: {
        id: body.customerId,
        organization: { userId },
      },
    });

    if (!customerExists) {
      return apiError("绑定的客户主体不存在或无权访问", 400);
    }

    // 3. 写入数据库
    const lead = await db.lead.create({
      data: {
        customerId: body.customerId,
        source: body.source,
        status: body.status,
        value: body.value,
      },
    });

    return apiResponse(lead, 201);
  } catch (error: any) {
    console.error("[POST /api/leads] 失败:", error);
    return apiError(error.message || "创建线索失败", 500);
  }
}
