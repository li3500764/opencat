// ============================================================
// GET /api/stats
// CRI Dashboard 商业价值与 ROI 统计 API (Day 11 重构版)
// ============================================================
//
// 职责：
//   1. 身份验证与组织校验隔离。
//   2. 高并发并行拉取 Outcome ROI 数据（ savedValue / savedHours 的 Sum 加总）。
//   3. 聚合统计 Recommendation 采纳率与 Stage 阶段漏斗。
//   4. 提取 14 天每日挽回价值和节省工时趋势，并提取最近的 Outcomes 流水账本。
//   5. 优雅处理未初始化组织的空数据。
//   6. 向后兼容原有 overview 对话/Agent 等计数。
//
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. 安全获取用户的组织主体
    const organization = await db.organization.findUnique({
      where: { userId },
    });

    // 若组织尚未建立，优雅返回零值默认包
    if (!organization) {
      return Response.json({
        totalSavedValue: 0,
        totalSavedHours: 0,
        activeSignalsCount: 0,
        adoptionRate: 0,
        recStats: { PENDING: 0, APPROVED: 0, REJECTED: 0, DISMISSED: 0 },
        stageDistribution: { LEAD: 0, TRIAL: 0, OPPORTUNITY: 0, CUSTOMER: 0, CHURNED: 0 },
        signalStats: [],
        dailyRoiTrend: Array.from({ length: 14 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return { date: d.toISOString().split("T")[0], value: 0, hours: 0 };
        }),
        outcomesLedger: [],
        overview: {
          totalConversations: 0,
          totalMessages: 0,
          totalAgents: 0,
          totalKnowledgeBases: 0,
          totalMemories: 0,
        }
      });
    }

    const orgId = organization.id;

    // 2. 并发拉取高阶 CRI 关系型统计数据，极大提高响应效率并降低 Waterfall 延迟
    const [
      outcomeAgg,
      activeSignalsCount,
      recStatsRaw,
      stagesRaw,
      signalStatsRaw,
      dailyRoiRaw,
      outcomesLedger,
      // 向后兼容指标计数
      totalConversations,
      totalMessages,
      totalAgents,
      totalKnowledgeBases,
      totalMemories,
    ] = await Promise.all([
      // (a) 累计 savedValue (挽回金额) 和 savedHours (节省时间)
      db.outcome.aggregate({
        where: { customer: { organizationId: orgId } },
        _sum: { savedValue: true, savedHours: true },
      }),

      // (b) 活跃的预警信号总数
      db.customerSignal.count({
        where: { customer: { organizationId: orgId }, isResolved: false },
      }),

      // (c) 建议状态分布 (用于计算采纳率)
      db.recommendation.groupBy({
        by: ["status"],
        where: { customer: { organizationId: orgId } },
        _count: { id: true },
      }),

      // (d) 客户生命周期阶段数量分布 (用于漏斗分析)
      db.customer.groupBy({
        by: ["stage"],
        where: { organizationId: orgId },
        _count: { id: true },
      }),

      // (e) 活跃的异动风险信号类型排行 (Top Alerts)
      db.customerSignal.groupBy({
        by: ["type"],
        where: { customer: { organizationId: orgId }, isResolved: false },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      // (f) 最近 14 天每日挽回增益 (SQL Raw 物理加总，避免 Node 端串行算力消耗)
      db.$queryRaw<Array<{ date: string; value: number; hours: number }>>`
        SELECT
          TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date,
          SUM(o."savedValue")::float as value,
          SUM(o."savedHours")::float as hours
        FROM "Outcome" o
        JOIN "Customer" c ON o."customerId" = c.id
        WHERE c."organizationId" = ${orgId}
          AND o."createdAt" >= NOW() - INTERVAL '14 days'
        GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `,

      // (g) Outcomes 闭环流水明细 ledger
      db.outcome.findMany({
        where: { customer: { organizationId: orgId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          customer: {
            select: { name: true, contactName: true }
          }
        }
      }),

      // (h) 向后兼容的基础计数量
      db.conversation.count({ where: { project: { userId } } }),
      db.message.count({ where: { conversation: { project: { userId } } } }),
      db.agent.count({ where: { project: { userId } } }),
      db.knowledgeBase.count({ where: { project: { userId } } }),
      db.memory.count({ where: { userId } }),
    ]);

    // 3. 格式化 AI 建议分布并精密计算采纳率 (APPROVED / (APPROVED + REJECTED + DISMISSED))
    const recStats = { PENDING: 0, APPROVED: 0, REJECTED: 0, DISMISSED: 0 };
    recStatsRaw.forEach((r) => {
      if (r.status in recStats) {
        recStats[r.status as keyof typeof recStats] = r._count.id;
      }
    });

    const totalReviewed = recStats.APPROVED + recStats.REJECTED + recStats.DISMISSED;
    const adoptionRate = totalReviewed > 0
      ? Math.round((recStats.APPROVED / totalReviewed) * 100)
      : 0;

    // 4. 格式化生命周期漏斗分布
    const stageDistribution = { LEAD: 0, TRIAL: 0, OPPORTUNITY: 0, CUSTOMER: 0, CHURNED: 0 };
    stagesRaw.forEach((s) => {
      if (s.stage in stageDistribution) {
        stageDistribution[s.stage as keyof typeof stageDistribution] = s._count.id;
      }
    });

    // 5. 格式化风险排行榜
    const signalStats = signalStatsRaw.map((s) => ({
      type: s.type,
      count: s._count.id,
    }));

    // 6. 填充 14 天内缺失日期 (防图表折线跳水和时区断开)
    const dailyMap = new Map<string, { value: number; hours: number }>();
    for (const row of dailyRoiRaw) {
      dailyMap.set(row.date, { value: row.value || 0, hours: row.hours || 0 });
    }

    const dailyRoiTrend: Array<{ date: string; value: number; hours: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      dailyRoiTrend.push(existing
        ? { date: dateStr, ...existing }
        : { date: dateStr, value: 0, hours: 0 }
      );
    }

    // 7. 输出整理好且向后兼容的 JSON
    return Response.json({
      totalSavedValue: outcomeAgg._sum.savedValue || 0,
      totalSavedHours: outcomeAgg._sum.savedHours || 0,
      activeSignalsCount,
      adoptionRate,
      recStats,
      stageDistribution,
      signalStats,
      dailyRoiTrend,
      outcomesLedger: outcomesLedger.map((o) => ({
        id: o.id,
        customerId: o.customerId,
        customerName: o.customer.name,
        contactName: o.customer.contactName,
        stage: o.stage,
        savedValue: o.savedValue || 0,
        savedHours: o.savedHours || 0,
        feedback: o.feedback,
        createdAt: o.createdAt.toISOString(),
      })),
      // 向后兼容支持
      overview: {
        totalConversations,
        totalMessages,
        totalAgents,
        totalKnowledgeBases,
        totalMemories,
      }
    });

  } catch (error: any) {
    console.error("[CRI Stats API] 统计聚合失败:", error);
    return Response.json(
      { error: "获取统计数据失败: " + (error.message || "未知原因") },
      { status: 500 }
    );
  }
}
