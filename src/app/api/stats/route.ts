// ============================================================
// Dashboard 统计数据 API
// ============================================================
// GET → 返回仪表盘所需的全部聚合数据（一次请求，减少 waterfall）
//
// 返回内容：
// 1. overview — 总量统计（对话/消息/Token/花费/Agent/知识库/记忆）
// 2. tokenUsage — Token 配额使用情况（quota/used/percentage）
// 3. dailyUsage — 最近 14 天每日用量（折线图数据源）
// 4. modelBreakdown — 按模型分组的用量统计（环形图数据源）
// 5. recentActivity — 最近 20 条调用记录（表格数据源）

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // ---- 并行查询，减少总耗时 ----
    const [
      user,
      totalConversations,
      totalMessages,
      tokenAgg,
      totalAgents,
      totalKnowledgeBases,
      totalMemories,
      dailyUsageRaw,
      modelBreakdownRaw,
      recentActivity,
    ] = await Promise.all([
      // 用户信息（配额）
      db.user.findUnique({
        where: { id: userId },
        select: { tokenQuota: true, tokenUsed: true, plan: true },
      }),

      // 总对话数
      db.conversation.count({
        where: { project: { userId } },
      }),

      // 总消息数
      db.message.count({
        where: { conversation: { project: { userId } } },
      }),

      // Token + 花费聚合
      db.usageLog.aggregate({
        where: { userId },
        _sum: { totalTokens: true, cost: true },
      }),

      // Agent 数量
      db.agent.count({
        where: { project: { userId } },
      }),

      // 知识库数量
      db.knowledgeBase.count({
        where: { project: { userId } },
      }),

      // 记忆数量
      db.memory.count({
        where: { userId },
      }),

      // 最近 14 天每日用量（原生 SQL，按天聚合）
      db.$queryRaw<Array<{ date: string; tokens: bigint; cost: number; messages: bigint }>>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
          SUM("totalTokens")::bigint as tokens,
          SUM("cost")::float as cost,
          COUNT(*)::bigint as messages
        FROM "UsageLog"
        WHERE "userId" = ${userId}
          AND "createdAt" >= NOW() - INTERVAL '14 days'
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `,

      // 按模型分组统计
      db.$queryRaw<Array<{ model: string; provider: string; tokens: bigint; cost: number; count: bigint }>>`
        SELECT
          "model",
          "provider",
          SUM("totalTokens")::bigint as tokens,
          SUM("cost")::float as cost,
          COUNT(*)::bigint as count
        FROM "UsageLog"
        WHERE "userId" = ${userId}
        GROUP BY "model", "provider"
        ORDER BY tokens DESC
      `,

      // 最近 20 条调用记录
      db.usageLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          model: true,
          provider: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          cost: true,
          createdAt: true,
        },
      }),
    ]);

    // ---- 填充 14 天中缺失的日期（没有调用的日期补 0）----
    const dailyMap = new Map<string, { tokens: number; cost: number; messages: number }>();
    for (const row of dailyUsageRaw) {
      dailyMap.set(row.date, {
        tokens: Number(row.tokens),
        cost: row.cost,
        messages: Number(row.messages),
      });
    }

    const dailyUsage: Array<{ date: string; tokens: number; cost: number; messages: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      dailyUsage.push(existing
        ? { date: dateStr, ...existing }
        : { date: dateStr, tokens: 0, cost: 0, messages: 0 }
      );
    }

    // ---- 模型分组（bigint → number）----
    const modelBreakdown = modelBreakdownRaw.map((row) => ({
      model: row.model,
      provider: row.provider,
      tokens: Number(row.tokens),
      cost: row.cost,
      count: Number(row.count),
    }));

    // ---- 组装响应 ----
    return Response.json({
      overview: {
        totalConversations,
        totalMessages,
        totalTokens: Number(tokenAgg._sum.totalTokens || 0),
        totalCost: tokenAgg._sum.cost || 0,
        totalAgents,
        totalKnowledgeBases,
        totalMemories,
      },
      tokenUsage: {
        quota: user?.tokenQuota || 100000,
        used: user?.tokenUsed || 0,
        percentage: user
          ? Math.round((user.tokenUsed / user.tokenQuota) * 100)
          : 0,
        plan: user?.plan || "FREE",
      },
      dailyUsage,
      modelBreakdown,
      recentActivity,
    });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    return Response.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
