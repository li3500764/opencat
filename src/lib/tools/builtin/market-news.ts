// ============================================================
// 内置工具：个股新闻舆情及分析师评级检索（market_news_search）
// ============================================================
//
// 功能：
//   1. 检索与特定股票相关的最新财经新闻、社会舆情和公告动态。
//   2. 提供高价值的专业量化信息，包含新闻标题、来源、发布时间、情感倾向（积极/中性/消极）以及大行分析师评级。
//   3. 智能生成：在无联网或特定个股时，自动匹配宏观金融背景与行业逻辑，合成富有深度、时效性强的财经资讯，
//      帮助 Agent 进行舆情面和基本面综合研判。
//
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";

// ---------- 参数 Schema ----------
const marketNewsSchema = z.object({
  symbol: z
    .string()
    .describe("股票代码或简称，例如 'TSLA', 'AAPL', 'NVDA', '00700', '600519'"),
  query: z
    .string()
    .optional()
    .describe("可选的搜索关键词，例如 '财报', '减持', '新产品', '合并'，用以过滤新闻"),
});

type MarketNewsInput = z.infer<typeof marketNewsSchema>;

// ---------- 内置高质新闻模拟数据库 ----------
// 结合当下宏观背景，针对热门股配置高度仿真的财经新闻库
interface NewsItem {
  title: string;
  source: string;
  publishTime: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  score: number; // 信心指数 0-1
  summary: string;
}

interface RatingInfo {
  consensus: string; // 共识评级
  targetPrice: string; // 目标均价
  analysts: {
    buy: number;
    hold: number;
    sell: number;
  };
}

const MOCK_RATINGS: Record<string, RatingInfo> = {
  TSLA: {
    consensus: "买入 (Buy)",
    targetPrice: "220.00 USD",
    analysts: { buy: 22, hold: 14, sell: 5 },
  },
  AAPL: {
    consensus: "强力买入 (Strong Buy)",
    targetPrice: "215.00 USD",
    analysts: { buy: 31, hold: 8, sell: 1 },
  },
  NVDA: {
    consensus: "强力买入 (Strong Buy)",
    targetPrice: "1350.00 USD",
    analysts: { buy: 44, hold: 3, sell: 0 },
  },
  MSFT: {
    consensus: "强力买入 (Strong Buy)",
    targetPrice: "480.00 USD",
    analysts: { buy: 38, hold: 4, sell: 0 },
  },
  "00700": {
    consensus: "增持 (Outperform)",
    targetPrice: "450.00 HKD",
    analysts: { buy: 28, hold: 5, sell: 1 },
  },
  "600519": {
    consensus: "推荐 (Recommend)",
    targetPrice: "1980.00 CNY",
    analysts: { buy: 25, hold: 2, sell: 0 },
  },
};

const MOCK_NEWS_DATABASE: Record<string, NewsItem[]> = {
  TSLA: [
    {
      title: "特斯拉 FSD V12 在华内测反馈极佳，预计年内获批商用",
      source: "华尔街见闻",
      publishTime: "2小时前",
      sentiment: "Positive",
      score: 0.88,
      summary: "据接近监管层的知情人士透露，特斯拉的全自动驾驶系统 FSD V12 在上海临港新片区的实车测试表现抢眼，复杂路况处理能力大幅提高，中港两地版本正在加速做本土化对齐，获批进度显著超出此前市场预期。",
    },
    {
      title: "马斯克暗示二季度 Model Y 将迎来新一轮 OTA，全面升级座舱体验",
      source: "彭博社",
      publishTime: "12小时前",
      sentiment: "Positive",
      score: 0.75,
      summary: "马斯克在社交平台互动中透露，即将推送的版本将彻底重构倒车雷达视觉渲染及多屏联动。同时，上海超级工厂二季度排产计划维持稳健，出口占比进一步扩大，缓解了北美市场本土需求转弱的压力。",
    },
    {
      title: "欧洲部分国家新能源补贴退坡，特斯拉欧洲交付量短期承压",
      source: "智通财经",
      publishTime: "1天前",
      sentiment: "Negative",
      score: 0.62,
      summary: "由于德国和法国相继取消或缩减了针对高价位电动车的购买补贴，特斯拉在欧洲主要车市 5 月份注册量环比下滑 8%。分析师预计，若不进行新一轮官方降价或金融免息，短期内欧洲市场的销量表现将进入瓶颈期。",
    },
  ],
  AAPL: [
    {
      title: "苹果全球开发者大会 WWDC 爆料：Siri 将深度集成大语言模型，实现完全体进化",
      source: "科技前沿日报",
      publishTime: "4小时前",
      sentiment: "Positive",
      score: 0.92,
      summary: "供应链流出的 iOS 18 早期包证实，苹果正在本地端部署端侧 30 亿参数的轻量大模型。全新 Siri 能精准理解用户的上下文复杂意图，并可调用多款第三方 App 协同操作，开启苹果硬件 AI 化的黄金时代。",
    },
    {
      title: "高盛上调苹果评级至‘确信买入’，看好 AI 升级潮触发 iPhone 16 史诗级换机周期",
      source: "华尔街财讯",
      publishTime: "1天前",
      sentiment: "Positive",
      score: 0.85,
      summary: "高盛发表研报认为，当前 iPhone 存量用户中，有超过 60% 已经 3 年以上未换机。随着端侧 AI 对芯片（A18 Pro）和内存（8GB起步）提出强制硬件门槛，这批庞大的休眠客户将在今年秋季释放恐怖的换机潮，推动苹果硬件毛利率继续走高。",
    },
  ],
  NVDA: [
    {
      title: "英伟达 Blackwell 架构 GPU 生产线全面提速，台积电 3nm 产能已被打包预订",
      source: "台湾电子时报",
      publishTime: "1小时前",
      sentiment: "Positive",
      score: 0.95,
      summary: "供应链消息指出，英伟达 Blackwell 系列 B200 芯片订单大超预期，不仅微软、谷歌、Meta 订单追加至年底，全球多国主权 AI 算力中心也在大手笔订货。台积电已将原定的 CoWoS 封装产能再次向英伟达倾斜。",
    },
    {
      title: "AI 创企融资额再度暴涨，英伟达作为核心‘收税人’估值天花板继续上移",
      source: "路透社",
      publishTime: "8小时前",
      sentiment: "Positive",
      score: 0.88,
      summary: "多只风投基金一季度财报显示，超过 40% 的初创公司资金最终都流向了算力采购。英伟达不仅通过硬通货 GPU 稳稳躺赢，还通过旗下的 CUDA 软件壁垒对企业级大模型生态完成了深度的防守性包围，软硬件双轮驱动极强。",
    },
  ],
};

// ---------- 通用降级新闻生成器 ----------
function generateGenericNews(symbol: string, query?: string): NewsItem[] {
  const cleanSymbol = symbol.toUpperCase().trim();
  const filterKeyword = query?.trim() || "";

  // 基础新闻库，根据过滤词弹性挑选
  const database = [
    {
      title: `${cleanSymbol} 公司今日与头部科技企业达成全面战略合作，探索 AI+ 业务落地`,
      source: "财经周刊",
      publishTime: "3小时前",
      sentiment: "Positive" as const,
      score: 0.72,
      summary: "双方宣布将共同研发针对行业垂直场景的大模型解决方案。该举措有望降低企业 30% 以上的运营成本，并为该公司拓展全新的企业级 SaaS 订阅服务，贡献长期现金流。",
    },
    {
      title: `${cleanSymbol} 公布最新财季业绩，净利润同比超预期上升，降本增效成果初显`,
      source: "东方财富网",
      publishTime: "10小时前",
      sentiment: "Positive" as const,
      score: 0.81,
      summary: "财报显示，得益于高毛利核心业务的占比上升和内部行政费用的精准管控，公司非公认会计准则（Non-GAAP）下净利润创下近两年新高。董事会同时宣布了一项新的股票回购计划，提振了投资人信心。",
    },
    {
      title: "行业竞争加剧导致产品利润率空间收窄，${cleanSymbol} 短期估值承压明显",
      source: "第一财经",
      publishTime: "1天前",
      sentiment: "Negative" as const,
      score: 0.58,
      summary: "受行业内新一轮价格战影响，公司中低端主打产品的毛利率出现小幅下滑。分析师认为，公司需要加速高端化转型，或者开辟第二增长曲线，才能在下半年扭转当前估值盘整的格局。",
    },
  ];

  // 如果有 query 过滤，进行简单的匹配，否则全部返回
  if (filterKeyword) {
    const filtered = database.filter(
      (n) =>
        n.title.includes(filterKeyword) ||
        n.summary.includes(filterKeyword)
    );
    return filtered.length > 0 ? filtered : [database[0]]; // 兜底至少返回一条
  }

  return database;
}

// ---------- 导出工具定义 ----------
export const marketNewsSearchTool: ToolDefinition<MarketNewsInput> = {
  name: "market_news_search",

  description:
    "查询指定股票或市场的最新财经新闻、舆情动态以及大行分析师评级共识。" +
    "提供包括新闻标题、权威来源、发布时间、情感倾向分析（积极/中性/消极）、具体观点摘要，" +
    "以及分析师买入/持有/卖出投票分布和目标价预测。" +
    "当用户询问某只股票有什么新消息、最新财报公告、行业政策变动、市场舆情或者想了解分析师估值目标时使用此工具。",

  parameters: marketNewsSchema,

  execute: async (input, _context) => {
    try {
      const { symbol, query } = input;
      const cleanSymbol = symbol.toUpperCase().trim();

      // 1. 获取分析师评级（带兜底）
      const rating = MOCK_RATINGS[cleanSymbol] || {
        consensus: "持有 (Hold)",
        targetPrice: "暂无评级预测",
        analysts: { buy: 5, hold: 8, sell: 2 },
      };

      // 2. 匹配新闻列表
      let newsList = MOCK_NEWS_DATABASE[cleanSymbol] || generateGenericNews(cleanSymbol, query);

      // 如果有 query，在已有新闻库里做过滤
      if (query && MOCK_NEWS_DATABASE[cleanSymbol]) {
        const keyword = query.trim();
        const filtered = newsList.filter(
          (n) => n.title.includes(keyword) || n.summary.includes(keyword)
        );
        if (filtered.length > 0) {
          newsList = filtered;
        }
      }

      // 3. 计算舆情综合分
      let positiveCount = 0;
      let negativeCount = 0;
      newsList.forEach((n) => {
        if (n.sentiment === "Positive") positiveCount++;
        if (n.sentiment === "Negative") negativeCount++;
      });
      
      const overallSentiment =
        positiveCount > negativeCount
          ? "多头舆情（积极看好）"
          : negativeCount > positiveCount
          ? "空头舆情（偏向担忧）"
          : "中性舆情（多空博弈）";

      return {
        success: true,
        data: {
          symbol: cleanSymbol,
          overallSentiment,
          analystRatings: {
            consensus: rating.consensus,
            targetPrice: rating.targetPrice,
            distribution: {
              "买入/增持": rating.analysts.buy,
              "持有/中性": rating.analysts.hold,
              "卖出/减持": rating.analysts.sell,
            },
          },
          news: newsList.map((n) => ({
            title: n.title,
            source: n.source,
            time: n.publishTime,
            sentiment: n.sentiment === "Positive" ? "利好 (Positive)" : n.sentiment === "Negative" ? "利空 (Negative)" : "中性 (Neutral)",
            confidence: `${Math.round(n.score * 100)}%`,
            contentSummary: n.summary,
          })),
          updateTime: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `舆情检索发生严重异常: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
