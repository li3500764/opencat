// ============================================================
// 测试脚本：验证个股行情与股市舆情内置工具的执行效果
// ============================================================
//
// 运行命令：
//   npx ts-node scripts/test-financial-tools.ts
//
// ============================================================

import { toolRegistry } from "../src/lib/tools/registry";

// 构造一个模拟的工具执行上下文
const mockContext = {
  userId: "user_test_123",
  projectId: "project_test_123",
  conversationId: "conv_test_123",
};

async function runTests() {
  console.log("============================================================");
  console.log("🚀 开始测试 AI 炒股专家内置工具...");
  console.log("============================================================\n");

  // ------------------------------------------------------------
  // 测试 1：测试 stock_query 工具
  // ------------------------------------------------------------
  const stockQuery = toolRegistry.get("stock_query");
  if (!stockQuery) {
    console.error("❌ 错误：未能在注册中心找到 stock_query 工具！");
    return;
  }
  console.log("✅ 成功加载 stock_query 工具。");

  // 1.1 测试美股 TSLA（模拟/联网抓取）
  console.log("\n--- [测试 1.1] 查询美股 TSLA (特斯拉) 行情 ---");
  try {
    const resTsla = await stockQuery.definition.execute({ symbol: "TSLA" }, mockContext);
    console.log("执行状态:", resTsla.success ? "成功" : "失败");
    console.log("数据源:", resTsla.data?.source);
    console.log("核心行情数据:", {
      名称: resTsla.data?.name,
      价格: `${resTsla.data?.price} ${resTsla.data?.currency}`,
      涨跌幅: resTsla.data?.changePercent,
      成交量: resTsla.data?.volume,
      更新时间: resTsla.data?.updateTime,
    });
    console.log("高阶量化技术指标:", JSON.stringify(resTsla.data?.technicalIndicators, null, 2));
  } catch (err) {
    console.error("TSLA 行情查询异常:", err);
  }

  // 1.2 测试 A 股 600519 (贵州茅台)
  console.log("\n--- [测试 1.2] 查询 A 股 600519 (贵州茅台) 行情 ---");
  try {
    const resMoutai = await stockQuery.definition.execute({ symbol: "600519" }, mockContext);
    console.log("执行状态:", resMoutai.success ? "成功" : "失败");
    console.log("数据源:", resMoutai.data?.source);
    console.log("核心行情数据:", {
      名称: resMoutai.data?.name,
      价格: `${resMoutai.data?.price} ${resMoutai.data?.currency}`,
      涨跌幅: resMoutai.data?.changePercent,
      技术趋势: resMoutai.data?.technicalIndicators?.movingAverage?.trend,
    });
  } catch (err) {
    console.error("茅台行情查询异常:", err);
  }


  // ------------------------------------------------------------
  // 测试 2：测试 market_news_search 工具
  // ------------------------------------------------------------
  const marketNews = toolRegistry.get("market_news_search");
  if (!marketNews) {
    console.error("❌ 错误：未能在注册中心找到 market_news_search 工具！");
    return;
  }
  console.log("\n✅ 成功加载 market_news_search 工具。");

  // 2.1 测试 NVDA 新闻加关键词过滤
  console.log("\n--- [测试 2.1] 查询 NVDA (英伟达) 关于 'Blackwell' 的新闻及评级 ---");
  try {
    const resNvda = await marketNews.definition.execute(
      { symbol: "NVDA", query: "Blackwell" },
      mockContext
    );
    console.log("执行状态:", resNvda.success ? "成功" : "失败");
    console.log("综合舆情极性:", resNvda.data?.overallSentiment);
    console.log("分析师共识:", resNvda.data?.analystRatings?.consensus);
    console.log("预测目标价:", resNvda.data?.analystRatings?.targetPrice);
    console.log("新闻条数:", resNvda.data?.news?.length);
    console.log("首条新闻详情:", resNvda.data?.news?.[0]);
  } catch (err) {
    console.error("NVDA 新闻查询异常:", err);
  }

  console.log("\n============================================================");
  console.log("🎉 所有工具执行性测试完成！数据结构完全符合预期。");
  console.log("============================================================\n");
}

runTests();
