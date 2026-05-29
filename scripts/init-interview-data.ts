import { config } from "dotenv";
config();

async function main() {
  const { db } = await import("../src/server/db/index.js");
  console.log("🚀 开始初始化面试场景数据...");

  // 1. 查找有效用户
  const user = await db.user.findFirst();
  if (!user) {
    console.log("❌ 数据库中没有用户。请先在前端登录一次以创建账号。");
    process.exit(1);
  }

  let project = await db.project.findFirst({ where: { userId: user.id } });
  if (!project) {
    console.log("⚠️ 用户没有项目，正在自动创建默认项目...");
    project = await db.project.create({
      data: {
        userId: user.id,
        name: "默认工作区",
        description: "面试演示工作区",
        defaultModel: "gpt-4o",
      }
    });
  }

  console.log(`✅ 找到目标用户项目: ${project.name}`);

  // 2. 检查是否已经存在招商顾问
  const existingAdvisor = await db.agent.findFirst({
    where: { projectId: project.id, name: { contains: "招商顾问分身" } }
  });

  if (existingAdvisor) {
    console.log("⚠️ 招商顾问分身已存在，跳过创建。");
  } else {
    const advisorPrompt = `你是星创科技园的招商顾问（数字分身），名字叫 Luna。
你的核心职责是提供 7×24 小时的园区咨询接待服务，统一话术，提升招商转化率。
你可以根据内部资料解答客户关于园区概况、面积、价格、配套设施和招商政策等问题。
你可以使用 property_match 工具来根据客户的行业、规模和预算智能匹配推荐房源，也可以使用 appointment 工具为客户预约现场看房。`;

    const advisor = await db.agent.create({
      data: {
        projectId: project.id,
        name: "招商顾问分身 - Luna",
        description: "负责 7×24 小时接待咨询，解答园区政策、面积价格、智能匹配房源，并预约看房。",
        systemPrompt: advisorPrompt,
        model: "gpt-4o",
        tools: ["property_match", "appointment", "datetime", "calculator"],
        temperature: 0.7,
        maxSteps: 10,
        isOrchestrator: false,
      }
    });
    console.log(`✅ 成功创建 Agent: ${advisor.name}`);
  }

  // 3. 检查租户服务分身
  const existingService = await db.agent.findFirst({
    where: { projectId: project.id, name: { contains: "租户服务分身" } }
  });

  if (existingService) {
    console.log("⚠️ 租户服务分身已存在，跳过创建。");
  } else {
    const servicePrompt = `你是星创科技园的租户服务管家（数字分身），名字叫 Max。
你的核心职责是为入驻企业提供高效的服务支持。
你可以回答关于入驻流程、装修规定、水电费、报修服务等常见问题。
当租户有报修或特殊服务需求时，你可以记录他们的请求并帮助预约跟进。`;

    const service = await db.agent.create({
      data: {
        projectId: project.id,
        name: "租户服务分身 - Max",
        description: "负责入驻企业服务、解答常见问题FAQ、报修投诉智能分流。",
        systemPrompt: servicePrompt,
        model: "gpt-4o",
        tools: ["datetime", "appointment", "memory_save", "memory_search"],
        temperature: 0.7,
        maxSteps: 10,
        isOrchestrator: false,
      }
    });
    console.log(`✅ 成功创建 Agent: ${service.name}`);
  }

  console.log("🎉 初始化完成！您可以到后台 Agent 管理页面查看新增加的数字分身。");
}

main()
  .catch((e) => {
    console.error("执行出错:", e);
    process.exit(1);
  });
