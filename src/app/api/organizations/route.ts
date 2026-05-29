import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { apiResponse, apiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";

// Zod 验证规则
const orgSchema = z.object({
  name: z.string().min(1, "组织名称不能为空").max(100, "组织名称最长100个字符"),
});

/**
 * GET /api/organizations
 * 获取当前用户的组织信息，若不存在则自动初始化默认组织以保障开箱即用。
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // 查询该用户的主组织
    let org = await db.organization.findUnique({
      where: { userId },
    });

    // 如果还没有组织，自动初始化创建一个
    if (!org) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const defaultName = `${user?.name || user?.email?.split("@")[0] || "Default"}'s Workspace`;
      
      org = await db.organization.create({
        data: {
          name: defaultName,
          userId,
        },
      });
    }

    return apiResponse(org);
  } catch (error: any) {
    console.error("[GET /api/organizations] 失败:", error);
    return apiError(error.message || "获取组织信息失败", 500);
  }
}

/**
 * POST /api/organizations
 * 更新或创建用户的组织信息
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("请先登录系统", 401);
    }
    const userId = session.user.id;

    // Zod 解析与校验请求体
    const body = await validateBody(orgSchema, req);

    // 采用 upsert 进行更新或创建
    const org = await db.organization.upsert({
      where: { userId },
      update: {
        name: body.name,
      },
      create: {
        name: body.name,
        userId,
      },
    });

    return apiResponse(org, 200);
  } catch (error: any) {
    console.error("[POST /api/organizations] 失败:", error);
    return apiError(error.message || "操作组织信息失败", 500);
  }
}
