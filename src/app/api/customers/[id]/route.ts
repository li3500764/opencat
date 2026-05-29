import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { CustomerStage } from "@prisma/client";

// 更新客户 Zod 校验 Schema
const updateCustomerSchema = z.object({
  name: z.string().min(1, "客户/公司名称不能为空").max(100, "客户名称最多 100 个字符").optional(),
  contactName: z.string().max(50, "联系人名字最多 50 个字符").optional().nullable(),
  email: z.string().email("邮箱格式错误").optional().nullable().or(z.literal("")),
  phone: z.string().max(20, "电话号码过长").optional().nullable(),
  industry: z.string().max(50, "行业类别过长").optional().nullable(),
  size: z.string().max(30, "公司规模过长").optional().nullable(),
  budget: z.number().nonnegative("预算不能为负数").optional().nullable(),
  stage: z.nativeEnum(CustomerStage).optional(),
});

/**
 * GET /api/customers/[id]
 * 获取单个客户 360 度全景立体资料视图（关联所有线索、沟通记录、风险预警和建议反馈）
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;
    const { id: customerId } = await params;

    // 查询该客户详情（限制组织隔离）
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        organization: { userId }, // 确保该用户是所属组织的拥有者
      },
      include: {
        leads: {
          orderBy: { createdAt: "desc" },
        },
        interactions: {
          orderBy: { contactDate: "desc" },
        },
        signals: {
          orderBy: { createdAt: "desc" },
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          include: {
            reviews: true,
          },
        },
        outcomes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      return apiError("客户主体不存在或无权访问", 404);
    }

    return apiResponse(customer);
  } catch (error: any) {
    console.error(`[GET /api/customers/[id]] ${error.message}`, error);
    return apiError(error.message || "获取客户详情失败", 500);
  }
}

/**
 * PUT /api/customers/[id]
 * 更新单个客户的基本信息与跟进阶段
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;
    const { id: customerId } = await params;

    // 1. Zod 校验请求体
    const body = await validateBody(updateCustomerSchema, req);

    // 2. 检查此客户归属权限
    const customerExists = await db.customer.findFirst({
      where: {
        id: customerId,
        organization: { userId },
      },
    });

    if (!customerExists) {
      return apiError("客户不存在或无权编辑", 404);
    }

    // 兼容邮箱空字符处理
    const emailVal = body.email === "" ? null : body.email;

    // 3. 执行更新
    const updatedCustomer = await db.customer.update({
      where: { id: customerId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.email !== undefined && { email: emailVal }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.industry !== undefined && { industry: body.industry }),
        ...(body.size !== undefined && { size: body.size }),
        ...(body.budget !== undefined && { budget: body.budget }),
        ...(body.stage && { stage: body.stage }),
      },
    });

    return apiResponse(updatedCustomer);
  } catch (error: any) {
    console.error(`[PUT /api/customers/[id]] ${error.message}`, error);
    return apiError(error.message || "更新客户资料失败", 500);
  }
}

/**
 * DELETE /api/customers/[id]
 * 删除客户实体及全部级联数据
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;
    const { id: customerId } = await params;

    // 1. 检查此客户是否存在且有权删除
    const customerExists = await db.customer.findFirst({
      where: {
        id: customerId,
        organization: { userId },
      },
    });

    if (!customerExists) {
      return apiError("客户不存在或无权删除", 404);
    }

    // 2. 执行级联物理删除（Prisma schema 已经配置了 onDelete: Cascade 级联）
    await db.customer.delete({
      where: { id: customerId },
    });

    return apiResponse({ message: "客户已成功物理删除" });
  } catch (error: any) {
    console.error(`[DELETE /api/customers/[id]] ${error.message}`, error);
    return apiError(error.message || "删除客户失败", 500);
  }
}
