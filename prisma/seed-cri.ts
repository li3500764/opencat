// ============================================================
// prisma/seed-cri.ts
// CRI 商业价值与 ROI 看板演示种子数据生成脚本 (Day 12)
// ============================================================
//
// 用法：
//   npx ts-node prisma/seed-cri.ts
//
// 职责：
//   1. 创建/重置演示账号 admin@opencat.com (密码: admin123456)。
//   2. 自动热初始化 Acme Corp 专属 Organization 与默认 Project。
//   3. 预置一个 RAG 销售 SOP 知识库，并向 DocumentChunk 批量注入四条高水准的 Playbook chunks，
//      确保即使没有 OpenAI Key 时，系统 fallback Keyword 匹配机制也能稳定提供话术 SOP。
//   4. 批量热生成 5 组全场景、多阶段、关联交互备注和预警信号的客户实体：
//      - 极狐科技 (LEAD, 入库漏跟进警告)
//      - 声网多媒体 (TRIAL, pgvector/Redis配置阻塞警报)
//      - 云从智能 (OPPORTUNITY, 关键人决策链单一、预算缩减警报)
//      - 字节跳动 (CUSTOMER, 录入已挽回 120,000 USD 的 ROI Outcome 看板闭环)
//      - 金山云 (CHURNED, 归档流失复盘 Outcomes)
//
// ============================================================

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient, CustomerStage, InteractionType, SignalLevel, RecommendationStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 辅助 ID 生成器，防 raw sql 主键冲突
function generateId(): string {
  return "cm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function main() {
  console.log("🚀 [CRI Seed] 正在启动 CRI 商业生态演示种子生成器...");

  const demoEmail = "admin@opencat.com";
  
  // 1. 清理已有演示账号及级联实体（保证一键 seed 能够完全平滑重置，防唯一键冲突）
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail }
  });

  if (existingUser) {
    console.log(`[CRI Seed] 检测到已有演示账号 ${demoEmail}，正在执行彻底级联清理重置...`);
    await prisma.user.delete({
      where: { id: existingUser.id }
    });
  }

  // 2. 新建演示用户 (密码采用 bcrypt 强哈希加密)
  const passwordHash = await bcrypt.hash("admin123456", 10);
  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      name: "演示销售总监",
      password: passwordHash,
      plan: "PRO",
      tokenQuota: 5000000, // 给演示账号充足的配额
    }
  });
  console.log(`[CRI Seed] 演示账户创建成功: ${user.email} (密码: admin123456)`);

  // 3. 创建主组织 (Acme Corp RevenueOps)
  const organization = await prisma.organization.create({
    data: {
      name: "Acme Corp 亚太 RevenueOps 卓越中心",
      userId: user.id
    }
  });
  console.log(`[CRI Seed] 主组织初始化成功: ${organization.name}`);

  // 4. 创建默认 Project
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "Default",
      description: "主跟进与客户关系智能管理项目",
      defaultModel: "gpt-5.4-mini"
    }
  });

  // 5. 预置 RAG 销售 SOP / Playbook 知识库
  const kb = await prisma.knowledgeBase.create({
    data: {
      projectId: project.id,
      name: "Acme 企业级销售跟进 SOP 官方 Playbook"
    }
  });

  const doc = await prisma.document.create({
    data: {
      knowledgeBaseId: kb.id,
      fileName: "B2B_Sales_SOP_Playbook_v2.md",
      fileType: "md",
      fileSize: 4096,
      chunkCount: 4,
      status: "ready"
    }
  });

  // 注入 4 条销售 SOP Chunks。因为本地部署可能未配置 pgvector embedder，
  // 我们直接插入 content，并将 embedding 字段设为 null。
  // RAG 系统会自动降级到 keyword 检索，保证 100% SLA 连通性。
  const sopChunks = [
    {
      index: 0,
      content: `[SaaS 试用期跟进 SOP]
当客户处于 TRIAL (试用) 阶段时，销售人员应紧密监控其系统活跃度。
若后台监控到由于 pgvector 向量数据库配置连接、Redis 缓存对接产生配置阻塞时，应在 12 小时内主动联系客户，发送《Prisma 7 向量存储与 RAG 高阶避坑指南》以及高级 Tool Calling 技术手册，并提议免费的技术支持会议。`
    },
    {
      index: 1,
      content: `[线索响应速度 (SLA) SOP]
当新线索 (LEAD) 录入系统后，销售经理应在 4 小时内发起跟进响应。
首轮电话或邮件跟进必须摸清客户的核心行业采购痛点 (特别针对 B2B SaaS、大数据或AI等行业)，确认其是否有项目启动预算及预计的商务决策链周期。`
    },
    {
      index: 2,
      content: `[商机冲刺商务 SOP]
当客户流转至 OPPORTUNITY (核心商机) 阶段且项目预算在 $50,000 USD 以上时，销售人员必须对齐采购决策人与技术负责人。
提议商务报价单草案发送，发起三方会谈推进签约流程。话术应聚焦于 ROI（预计可帮其在业务场景中挽回 25% 停滞商机，并节省 30% 人工时间）。`
    },
    {
      index: 3,
      content: `[已流失线索挽回 SOP]
针对 CHURNED (已流失) 阶段客户，切忌过度打扰。每隔 6 个月进行轻度的行业趋势季报、AI Agent Runtime 行业白皮书等干货发送。
以弱联系维系信任，随时探测其未来重组或重新批复采购预算的机会。`
    }
  ];

  await prisma.documentChunk.createMany({
    data: sopChunks.map(c => ({
      documentId: doc.id,
      content: c.content,
      chunkIndex: c.index
    }))
  });
  console.log(`[CRI Seed] RAG 销售 SOP 知识库构建成功，已注入 ${sopChunks.length} 条 Playbook 规则文本 Chunks。`);

  // ============================================================
  // 6. 热生成 5 大生命周期阶段立体客户场景
  // ============================================================

  // ------------------------------------------------------------
  // 客户 A：极狐科技有限公司 (LEAD 线索，漏跟进超时警报)
  // ------------------------------------------------------------
  const customerLead = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: "极狐科技有限公司 (GitLab 亚太研发中心)",
      contactName: "王经理",
      email: "wang.lead@jihulab.com",
      phone: "13912345678",
      industry: "B2B SaaS 开发工具",
      size: "200-500人",
      budget: 35000.0,
      stage: CustomerStage.LEAD
    }
  });

  // 该线索只录入了一条初始 Interaction (入库纪要)，且由于没有销售电话跟进，触发 SLA 预警
  await prisma.interaction.create({
    data: {
      customerId: customerLead.id,
      type: InteractionType.NOTE,
      content: "极狐科技技术部门在官网下载并试用了 AI Orchestrator 底座。对方目前正在评估将内部工单系统升级为智能化 Agent 编排的可行性，需要支持 PostgreSQL vector 连接。",
      contactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3天前
    }
  });

  await prisma.customerSignal.create({
    data: {
      customerId: customerLead.id,
      type: "no_followup",
      level: SignalLevel.WARNING,
      description: "该线索已入库超过 72 小时，尚未建立任何有效的销售电话跟进，SLA 严重超时，请尽快联络王经理。",
      isResolved: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  // ------------------------------------------------------------
  // 客户 B：声网多媒体企业 (TRIAL 试用，pgvector配置卡点警报)
  // ------------------------------------------------------------
  const customerTrial = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: "声网多媒体互动网络",
      contactName: "李总",
      email: "li.trial@shengwang.cn",
      phone: "13888889999",
      industry: "实时音视频与音效",
      size: "500-1000人",
      budget: 68000.0,
      stage: CustomerStage.TRIAL
    }
  });

  // 录入跟进足迹时间线
  await prisma.interaction.createMany({
    data: [
      {
        customerId: customerTrial.id,
        type: InteractionType.CHAT,
        content: "李总反馈：已经成功在测试环境中运行了 OpenCat 底座。但在连接公司的 pgvector 向量库时，偶尔会报错超时，且对大量 chunks 批量向量化写入的并发稳定性有一点疑问。",
        contactDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        customerId: customerTrial.id,
        type: InteractionType.CALL,
        content: "电话回访：李总今天试用了系统的智能分析页面，对我们推荐的下一步 SOP 动作表示认可。李总重申：如果 pgvector 读写稳定性及并发限流方案能够顺利落地，本月他们愿意将试用阶段推进到商机采购谈判中。",
        contactDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // 注入未决风险报警信号
  await prisma.customerSignal.createMany({
    data: [
      {
        customerId: customerTrial.id,
        type: "trial_expired",
        level: SignalLevel.CRITICAL,
        description: "该企业客户试用周期仅剩 2 天，即将于本周到期，请尽快进行续期确认或商务会谈。",
        isResolved: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        customerId: customerTrial.id,
        type: "negative_sentiment",
        level: SignalLevel.WARNING,
        description: "系统检测到客户对 pgvector 向量写入并发稳定性产生担忧，存在核心技术连接疑惑卡点，请销售跟技术支持介入。",
        isResolved: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // ------------------------------------------------------------
  // 客户 C：云从智能网络 (OPPORTUNITY 商机冲刺，关键人决策单一与预算卡点)
  // ------------------------------------------------------------
  const customerOpp = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: "云从智能网络系统有限公司",
      contactName: "赵总",
      email: "zhao.opp@yuncong.com",
      phone: "15500001111",
      industry: "AI 人工智能与智慧安防",
      size: "1000人以上",
      budget: 120000.0,
      stage: CustomerStage.OPPORTUNITY
    }
  });

  await prisma.interaction.createMany({
    data: [
      {
        customerId: customerOpp.id,
        type: InteractionType.MEETING,
        content: "线下商务会谈：在对方上海总部开会。对方采购决策人赵总表示，技术评估已经全面通过，但目前集团正在经历下半年的预算缩减，需要我们将整体的商务报价进行适度优化。同时，对方采购部门决策链中只关联了赵总一人，技术总监李总尚未拉入决策群聊，存在对接面偏窄的安全隐患。",
        contactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  await prisma.customerSignal.create({
    data: {
      customerId: customerOpp.id,
      type: "competitor_mention",
      level: SignalLevel.WARNING,
      description: "客户在开会中口头提及竞品公司的多模型低成本方案，正在评估价格可行性，商务进入价格攻坚期。",
      isResolved: false,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    }
  });

  // 为商机生成一个 pending 建议
  await prisma.recommendation.create({
    data: {
      customerId: customerOpp.id,
      intentScore: "hot",
      riskReason: "正处于商机冲刺关键签约期，但遭遇采购部预算卡点，且决策层中只关联了单一联系人赵总。",
      nextAction: "【冲刺SOP建议】提议召开商务与安全性评估三方会议，正式发起商务报价单草案。在话术中融入 ROI 测算（预计可帮其在业务场景中挽回 25% 停滞商机，并节省 30% 人工时间），说服对方。",
      talkTrack: `您好，赵总！感谢您和团队对我们智能工作台的认可。针对您提起的集团预算微调，我们高度重视。为了向贵司的财务与采购委员会提供最直接的采购证明，我们特别拟定了一份 ROI 经营效益分析。附件中是方案和报价单草案，请您审阅。`,
      evidence: JSON.stringify([
        { type: "signal", source: "预算监控", text: "商机预算在 $50k 以上" },
        { type: "interaction", source: "会谈纪要", text: "赵总提到了采购部门预算缩减" }
      ]),
      status: RecommendationStatus.PENDING
    }
  });

  // ------------------------------------------------------------
  // 客户 D：字节跳动数据部 (CUSTOMER 成交，ROI 大盘数据标杆)
  // ------------------------------------------------------------
  const customerCust = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: "字节跳动数据智能部门 (ByteDance)",
      contactName: "陆总",
      email: "lu.cust@bytedance.com",
      phone: "18622223333",
      industry: "大数据与内容算法推荐",
      size: "1000人以上",
      budget: 150000.0,
      stage: CustomerStage.CUSTOMER
    }
  });

  await prisma.interaction.createMany({
    data: [
      {
        customerId: customerCust.id,
        type: InteractionType.MEETING,
        content: "成功签约！通过人机协作话术跟进（陆总十分认可我们针对其技术痛点发出的 pgvector 向量存储避坑指南，且在报价方案中对齐了 45 小时的工时节省），字节跳动数据智能部正式同我们达成 $120,000 USD 的年度框架合同！",
        contactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // 写入核心 Outcomes ROI 大盘流水数据！
  // 5天前成功成交， savedValue = 120,000 USD, savedHours = 45 小时
  const outcome1 = await prisma.outcome.create({
    data: {
      customerId: customerCust.id,
      stage: CustomerStage.CUSTOMER,
      savedValue: 120000.0,
      savedHours: 45.0,
      feedback: "客户极度认可 AI 话术的专业性，成功推进商务签约闭环，挽回 Pipeline 价值 $120,000 USD 并通过 SOP 自动化跟进省去 45 小时的人工沟通记录整理成本。",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  });

  // 写入一条 APPROVED 的建议归档，以正确体现 100% 的 AI 建议采纳率
  const recCust = await prisma.recommendation.create({
    data: {
      customerId: customerCust.id,
      intentScore: "hot",
      riskReason: null,
      nextAction: "【商务SOP建议】对齐年度预算框架合同推进...",
      talkTrack: "您好，陆总！关于我们在 pgvector 和 RAG 检索稳定性上的商务答疑...",
      evidence: JSON.stringify([]),
      status: RecommendationStatus.APPROVED
    }
  });

  await prisma.humanReview.create({
    data: {
      recommendationId: recCust.id,
      userId: user.id,
      action: "APPROVE",
      modifiedContent: "采纳了 AI 的技术答疑草稿并发给陆总",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  });

  // ------------------------------------------------------------
  // 客户 E：金山云创新中心 (CHURNED 归档流失复盘)
  // ------------------------------------------------------------
  const customerChurn = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: "金山云科技创新中心",
      contactName: "陈总",
      email: "chen.churn@kingsoft.com",
      phone: "17733334444",
      industry: "云计算与云存储",
      size: "500-1000人",
      budget: 50000.0,
      stage: CustomerStage.CHURNED
    }
  });

  await prisma.interaction.createMany({
    data: [
      {
        customerId: customerChurn.id,
        type: InteractionType.NOTE,
        content: "流失复盘记录：金山云因下半年云计算预算整体收缩，且其架构委员会决定全面转向内部开源自研方案，项目被终止，商机处于 LOST 流失归档状态。",
        contactDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  const outcome2 = await prisma.outcome.create({
    data: {
      customerId: customerChurn.id,
      stage: CustomerStage.CHURNED,
      savedValue: 0.0,
      savedHours: 8.0, // 销售复盘省下了 8 小时的人工整理成本
      feedback: "商机流失。复盘流失原因为预算收缩与转向内部开源自研。留存 8 小时流失数据档案以备后期重组预算探测。",
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    }
  });

  // 写入一条 DISMISSED 建议，用作多状态计算
  await prisma.recommendation.create({
    data: {
      customerId: customerChurn.id,
      intentScore: "at-risk",
      riskReason: "采购预算停滞缩减，存在云平台转向自研流失倾向。",
      nextAction: "【流失防范SOP】标记流失归档，每半年定期发送季报。",
      talkTrack: "陈总您好，祝贵司业务顺利。附件中是本季度白皮书...",
      evidence: JSON.stringify([]),
      status: RecommendationStatus.DISMISSED
    }
  });

  // ============================================================
  // 7. 注入折线趋势需要的辅助 Outcome 数据 (模拟过去 14 天每日的零散增益)
  // ============================================================
  
  // 字节跳动陆总前几天的预备 Outcomes 增益，帮助大盘绘制出极精美的阶梯状增长曲线
  await prisma.outcome.createMany({
    data: [
      {
        customerId: customerCust.id,
        stage: CustomerStage.OPPORTUNITY,
        savedValue: 35000.0,
        savedHours: 12.0,
        feedback: "第一轮商务提案采纳，对方决策链拉入关键技术负责人，推进商机价值 $35,000 USD 并节省 12 小时。",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10天前
      },
      {
        customerId: customerCust.id,
        stage: CustomerStage.OPPORTUNITY,
        savedValue: 85000.0,
        savedHours: 25.0,
        feedback: "第二轮技术避坑方案认可，对方财务及法务流程介入，累计挽回至 $85,000 USD 并节省 25 小时。",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      }
    ]
  });

  console.log("💚 [CRI Seed] CRI 商业生态种子数据注入成功！");
  console.log(`
  ============================================================
   CRI 演示账号已就绪:
   - 登录邮箱: \x1b[32m${demoEmail}\x1b[0m
   - 登录密码: \x1b[32madmin123456\x1b[0m
   
   注入的商业大盘数据亮点:
   - 累计已挽回 Pipeline 价值: \x1b[33m$240,000.0 USD\x1b[0m
   - 累计已自动省去销售工时: \x1b[36m90.0 Hours\x1b[0m
   - 已备好 5 个多阶段销售线索客户，包含活跃 SLA SLA / 风险警报。
   - 销售跟进 SOP RAG 知识库已物理预置 Chunks。
  ============================================================
  `);
}

main()
  .catch((e) => {
    console.error("❌ [CRI Seed] 种子数据注入失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
