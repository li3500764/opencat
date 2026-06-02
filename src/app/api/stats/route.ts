// ============================================================
// GET /api/stats
// OpenCat 个人 AI 生产力与用量大盘统计 API (重构版)
// ============================================================
//
// 职责：
//   1. 身份验证与用户隔离安全校验。
//   2. 高并发并行查询用户的基本计数（对话数、消息数、知识库数、Agent数等）。
//   3. 查询 User 表中的 tokenQuota 与已用 tokenUsed 额度。
//   4. 聚合 UsageLog 表，算得该用户累计消耗的总 Token、总 API 花费（Cost USD）。
//   5. 按天分组过去 14 天的每日 Token 用量、费用及请求数趋势，解决断点跳水问题。
//   6. 提取 Model 分布，计算各模型消耗 Token、生成次数和费用占比。
//   7. 提取最近 15 次真实的 AI 对话请求日志，进行精细化账目展示。
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
    // 1. 并发并行拉取基础表计数量 + 用量日志聚合 (极高吞吐效率)
    const [
      user,
      totalConversations,
      totalMessages,
      totalAgents,
      totalKnowledgeBases,
      totalMemories,
      usageStatsAgg,
      modelStatsRaw,
      recentUsageLogs,
      usageLogsTrendRaw,
    ] = await Promise.all([
      // (a) 查询用户个人的配额信息
      db.user.findUnique({
        where: { id: userId },
        select: { tokenQuota: true, tokenUsed: true, name: true, email: true },
      }),

      // (b) 基础计数
      db.conversation.count({ where: { project: { userId } } }),
      db.message.count({ where: { conversation: { project: { userId } } } }),
      db.agent.count({ where: { project: { userId } } }),
      db.knowledgeBase.count({ where: { project: { userId } } }),
      db.memory.count({ where: { userId } }),

      // (c) 累计 Token 消耗与费用总和
      db.usageLog.aggregate({
        where: { userId },
        _sum: { totalTokens: true, cost: true },
      }),

      // (d) 模型用量占比分布
      db.usageLog.groupBy({
        by: ["model", "provider"],
        where: { userId },
        _sum: { totalTokens: true, cost: true },
        _count: { id: true },
      }),

      // (e) 最近 15 次 API 活动记录
      db.usageLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      // (f) 过去 14 天的每日详细用量（折线图使用）
      db.usageLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          createdAt: true,
          totalTokens: true,
          cost: true,
        },
      }),
    ]);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // 2. 格式化模型使用分布
    const modelDistribution = modelStatsRaw.map((item) => ({
      model: item.model,
      provider: item.provider,
      tokens: item._sum.totalTokens || 0,
      cost: item._sum.cost || 0,
      count: item._count.id || 0,
    })).sort((a, b) => b.tokens - a.tokens);

    // 3. 构建 14 天时间序列数据，填充无用量日期的零值，防止折线图断裂
    const dailyMap = new Map<string, { tokens: number; cost: number; messages: number }>();
    for (const log of usageLogsTrendRaw) {
      const dateStr = log.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || { tokens: 0, cost: 0, messages: 0 };
      existing.tokens += log.totalTokens || 0;
      existing.cost += log.cost || 0;
      existing.messages += 1; // 一次 log 计为一次对话消息
      dailyMap.set(dateStr, existing);
    }

    const dailyRoiTrend: Array<{ date: string; tokens: number; cost: number; messages: number; value: number; hours: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      
      dailyRoiTrend.push({
        date: dateStr,
        tokens: existing ? existing.tokens : 0,
        cost: existing ? parseFloat(existing.cost.toFixed(4)) : 0,
        messages: existing ? existing.messages : 0,
        // 向后兼容旧字段 (CRI 看板折线图渲染，防止意外崩溃)
        value: existing ? existing.tokens : 0,
        hours: existing ? parseFloat(existing.cost.toFixed(4)) : 0,
      });
    }

    // 4. 组装最终的大盘统计报包
    return Response.json({
      // 核心大盘计数
      user: {
        name: user.name,
        email: user.email,
        tokenQuota: user.tokenQuota,
        tokenUsed: user.tokenUsed,
      },
      overview: {
        totalConversations,
        totalMessages,
        totalAgents,
        totalKnowledgeBases,
        totalMemories,
      },
      // 聚合用量指标
      totalTokens: usageStatsAgg._sum.totalTokens || 0,
      totalCost: usageStatsAgg._sum.cost || 0,
      
      // 折线趋势图 (14天)
      dailyRoiTrend, // 在前端中用作 14天 Token/Cost 趋势图

      // 饼图/环形图用
      modelDistribution,

      // 最近审计流水
      recentActivity: recentUsageLogs.map((log) => ({
        id: log.id,
        model: log.model,
        provider: log.provider,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        cost: log.cost,
        createdAt: log.createdAt.toISOString(),
      })),

      // ----------------------------------------------------
      // 向后兼容旧 B2B CRM 大盘参数，防止路由切换时未刷新的界面报错
      // ----------------------------------------------------
      totalSavedValue: usageStatsAgg._sum.totalTokens || 0, // 映射到 tokens
      totalSavedHours: usageStatsAgg._sum.cost || 0,       // 映射到 cost
      activeSignalsCount: 0,
      adoptionRate: 100,
      recStats: { PENDING: 0, APPROVED: 0, REJECTED: 0, DISMISSED: 0 },
      stageDistribution: { LEAD: 0, TRIAL: 0, OPPORTUNITY: 0, CUSTOMER: 0, CHURNED: 0 },
      signalStats: [],
      outcomesLedger: [],
    });

  } catch (error: any) {
    console.error("[Stats API Redesign] 聚合大盘用量失败:", error);
    return Response.json(
      { error: "获取大盘用量数据失败: " + (error.message || "未知原因") },
      { status: 500 }
    );
  }
}
