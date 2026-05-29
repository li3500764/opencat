import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { CustomerStage } from "@prisma/client";

// 创建客户 Zod 校验 Schema
const createCustomerSchema = z.object({
  name: z.string().min(1, "客户/公司名称不能为空").max(100, "客户名称最多 100 个字符"),
  contactName: z.string().max(50, "联系人名字最多 50 个字符").optional().nullable(),
  email: z.string().email("邮箱格式错误").optional().nullable().or(z.literal("")),
  phone: z.string().max(20, "电话号码过长").optional().nullable(),
  industry: z.string().max(50, "行业类别过长").optional().nullable(),
  size: z.string().max(30, "公司规模过长").optional().nullable(),
  budget: z.number().nonnegative("预算不能为负数").optional().nullable(),
  stage: z.nativeEnum(CustomerStage).optional().default(CustomerStage.LEAD),
});

/**
 * GET /api/customers
 * 获取并筛选客户列表（支持按意向阶段、行业、姓名等字段检索）
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 防范幽灵 Session：数据库可能已被清空重置，但浏览器 Cookie 依然有残留 JWT
    const userExists = await db.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
      return apiError("当前会话已失效，用户已被清理，请重新登录", 401);
    }

    // 1. 先获取该用户的 Organization
    const org = await db.organization.findUnique({
      where: { userId },
    });
    if (!org) {
      return apiResponse([]); // 如果还没有组织，返回空列表
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage") as CustomerStage | null;
    const search = searchParams.get("search") || "";
    const industry = searchParams.get("industry") || "";

    // 3. 构建 Prisma 查询条件
    const whereClause: any = {
      organizationId: org.id,
    };

    if (stage) {
      whereClause.stage = stage;
    }

    if (industry) {
      whereClause.industry = {
        contains: industry,
        mode: "insensitive",
      };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // 4. 查询客户列表
    const customers = await db.customer.findMany({
      where: whereClause,
      include: {
        leads: true,
        signals: {
          where: { isResolved: false }, // 默认带出未处理的信号预警
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 1, // 默认带出最新的一条 AI 建议
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return apiResponse(customers);
  } catch (error: any) {
    console.error("[GET /api/customers] 失败:", error);
    return apiError(
      `${error.message || "获取客户列表失败"} | 详细堆栈: ${error.stack || "无"}`,
      500
    );
  }
}

/**
 * POST /api/customers
 * 创建新的客户主体并关联至主组织
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 防范幽灵 Session：数据库可能已被清空重置，但浏览器 Cookie 依然有残留 JWT
    const userExists = await db.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
      return apiError("当前会话已失效，用户已被清理，请重新登录", 401);
    }

    // 1. 获取并校验请求体
    const body = await validateBody(createCustomerSchema, req);

    // 2. 检索用户的 Organization（如果不存在，自动初始化）
    let org = await db.organization.findUnique({
      where: { userId },
    });
    if (!org) {
      org = await db.organization.create({
        data: {
          name: `${session.user.name || "Default"}'s Workspace`,
          userId,
        },
      });
    }

    // 处理邮箱空字符串转为 null 的兼容性
    const emailVal = body.email === "" ? null : body.email;

    // 3. 写入数据库
    const customer = await db.customer.create({
      data: {
        organizationId: org.id,
        name: body.name,
        contactName: body.contactName,
        email: emailVal,
        phone: body.phone,
        industry: body.industry,
        size: body.size,
        budget: body.budget,
        stage: body.stage,
        ownerId: userId, // 默认归属于当前创建人
      },
    });

    return apiResponse(customer, 201);
  } catch (error: any) {
    console.error("[POST /api/customers] 失败:", error);
    return apiError(
      `${error.message || "创建客户失败"} | 详细堆栈: ${error.stack || "无"}`,
      500
    );
  }
}
