# OpenCat CRI - RevenueOps FDE

> 面向 SalesOps / RevenueOps 的客户关系智能 Agent 工作台

## 项目定位
OpenCat CRI 是基于 OpenCat Agent Runtime 演进出来的企业级客户关系智能产品，面向 SalesOps / RevenueOps 场景。目标不是做“CRM 加 AI 聊天框”，而是把客户资料、沟通记录、订单、售后、销售 SOP、企业知识库和工作流串起来，帮助业务人员理解客户状态、推荐下一步动作，并通过人工确认和结果回写形成可复盘的经营闭环。

底层仍然保留 OpenCat 的 AI Agent 编排平台能力：多模型 LLM Gateway、多 Agent 编排（Orchestrator 模式）、ReAct Agent 引擎 + Tool Calling、Memory 自动记忆 + RAG 知识库、项目隔离 + Agent 配置、Token 计费 + Dashboard、用户认证 + API Key 管理。

**故意不用 LangChain**，自研 Agent Runtime 保证底层原理的可控性。

---

## 企业化转向：CRI / 客户关系智能
核心叙事要从 **记录客户关系** 升级为 **辅助经营客户关系**：
- **客户画像理解**：自动汇总客户行业、规模、预算、历史需求、购买阶段、沟通偏好、风险信号。
- **意向等级判断**：结合线索来源、互动频率、最近沟通、订单/试用/报价状态，判断客户热度和流失风险。
- **下一步动作推荐**：根据销售 SOP、客户状态和历史最佳实践，生成跟进任务、沟通策略、话术草稿、升级建议。
- **人工兜底协作**：复杂客服问题、重大客户风险、高金额商机不能让 AI 自动越权处理，必须转人工确认。
- **结果沉淀闭环**：采纳、修改、驳回、成交、流失、转人工等结果要回写系统，形成企业自己的客户经营知识。

这意味着 OpenCat 的商业化价值是“企业客户经营的 AI 操作层”：它能把 CRM、知识库、SOP、工具调用、Agent 工作流和人工审批串成一个可验收的业务闭环。

---

## FDE 式 B 端交付方法
B 端 AI 项目最好的交付方式是 **FDE（Forward Deployed Engineer）式交付 + AI Agent 工具链 + 工作流配置**：
1. **先小场景闭环**：选高频、明确、能验收、能算 ROI 的场景，第一版优先推荐从 **销售跟单 / 线索挽回** 切入。
2. **先摸清客户流程，再上 Agent**：先理解企业现有流程（谁接线索、多久超时、什么情况转主管、哪些话术不能说），Agent 只是把这些流程自动化、结构化、可追踪。
3. **用 Agent + 工具调用 + 工作流跑通闭环**：Agent 负责理解和生成建议；工具调用负责查外部数据；工作流负责把“AI建议 → 人工确认 → 执行 → 结果回写 → 复盘优化”串起来。
4. **把企业知识沉淀成模板**：每次交付沉淀 SOP 模板、知识库结构、权限规则、日志规范、人工兜底规则、ROI 指标。
5. **价值必须可量化**：替代了多少人工时间？挽回了多少流失线索？减少了多少 SLA 超时？带来了多少 Pipeline 价值？

---

## 架构判断：不推倒重构，做业务应用层重构
**不需要新建项目或整体推倒重写**。保留底层自研 Agent Runtime 亮点，同时重构上层业务表现。

```
保留并强化：
- src/lib/llm/**              多模型网关
- src/lib/agent/**            Agent Runtime / Orchestrator
- src/lib/tools/**            工具调用体系
- src/lib/memory/**           Memory + RAG
- src/lib/auth.ts             登录鉴权
- src/lib/crypto.ts           密钥加密
- prisma/User/ApiKey/UsageLog 个人账号、密钥、成本追踪

新增业务层：
- Organization / Workspace    企业工作区
- Customer / Lead / Account   客户关系对象
- Interaction / Order / Ticket 沟通、订单、售后上下文
- Recommendation / Workflow   AI 建议、人工确认、结果回写
- ROI / Outcome               业务价值复盘

降级但保留：
- /chat                       Agent 调试台，不再作为产品主入口
- Conversation / Message      用于解释 Agent 过程和保存分析对话

重构主入口：
- /dashboard                  从 Token 看板升级为业务 ROI 看板
- /customers 或 /sales/leads  成为 CRI 主工作台
- /settings/knowledge         从通用知识库升级为企业 SOP / Playbook 管理
- /settings/agents            从通用 Agent 管理升级为业务 Agent 模板管理
```

---

## CRI MVP 业务闭环
**场景：销售跟单 / 线索挽回**
* **输入**：
  - Lead / Customer 基础资料（行业、职位、金额估算等）。
  - Interaction 沟通记录（邮件、电话纪要、会议纪要等）。
  - Order / Trial / Ticket 上下文（试用状态、售后问题等）。
  - SOP / Playbook（销售跟进规范、竞品 FAQ、价格政策）。
* **AI 输出**：
  - 客户画像摘要、意向等级（hot / warm / cold / at-risk）与风险判断。
  - 下一步动作建议（跟进任务、优先级）。
  - 引用客户上下文的话术草稿。
  - 转人工建议（复杂投诉、高金额敏感问题）。
* **人工闭环**：
  - 业务人员对 AI 建议进行采纳、修改、驳回或转人工，保存处理原因。
  - 驳回的建议进入反馈池，采纳的建议生成任务。
* **ROI 闭环**：
  - 可挽回 Pipeline = 风险线索金额 × 默认挽回概率。
  - 节省工时 = 分析客户数 × 人工整理基准耗时。
  - 采纳率、SLA 改善率、成交/推进等复盘结果。

---

## 技术栈与开发环境
* **框架**：Next.js 16 (App Router) + TypeScript
* **UI**：TailwindCSS 4 + Geist 字体（设计风格：暖灰+琥珀色，**禁止紫色/AI渐变风**）
* **ORM**：Prisma 7（client engine + @prisma/adapter-pg + pg Pool）
* **数据库**：PostgreSQL 17 (pgvector) + Redis 7（Docker PG 映射到 **5433** 端口）
* **认证**：NextAuth.js v5 (Auth.js)，JWT session
* **AI SDK**：Vercel AI SDK 6.x (@ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google)
* **状态管理**：Zustand
* **部署**：Docker Compose
* **运行端口**：Next.js dev 跑在 **3001** 端口

---

## Runtime 底座已完成能力

| 阶段 | 目标 | 核心实现 | 状态 |
|-----|------|---------|------|
| Day 1 | 脚手架 + 认证 + DB | Next.js 16 + NextAuth v5 + Prisma 7 (pgvector) | ✅ 已完成 |
| Day 2 | 单模型对话 + SSE 流式 | streamText + toUIMessageStreamResponse + Zustand chatStore | ✅ 已完成 |
| Day 3 | 多模型 Gateway + Key 管理 | 动态 Provider 抽象 (OpenAI/Anthropic/Gemini/DeepSeek) + AES 加密 | ✅ 已完成 |
| Day 4 | Tool Calling + ReAct 引擎 | ToolRegistry + ReAct Agent Engine + Builtin Tools | ✅ 已完成 |
| Day 5 | 多 Agent 编排 + 项目隔离 | Orchestrator Agent + call_agent 工具 + Agent CRUD | ✅ 已完成 |
| Day 6 | Memory 系统 + RAG 知识库 | pgvector 向量检索 + embedMany + memory_save/search 工具 | ✅ 已完成 |
| Day 7 | Dashboard + Docker 生产部署 | stats API + 纯 SVG 手绘图表 + Dockerfile 多阶段构建 | ✅ 已完成 |

### 底座开发踩坑备忘

1. **AI SDK 6.x 变动**：
   - `Message` 变更为 `UIMessage`，结构采用 `parts` 数组形式，需要 await `convertToModelMessages()`。
   - `maxSteps` 废弃，流式调用使用 `stopWhen: stepCountIs(N)` 控制 ReAct 深度。
   - 服务端返回使用 `toUIMessageStreamResponse()`。
   - 自定义代理或第三方平台（如 DeepSeek）不支持 Responses API 协议，需要在 `createModel()` 中针对 `openai-responses` 格式自动降级为 `.chat()` (即 `/chat/completions`)。

2. **Prisma 7 & pgvector**：
   - datasource url 必须放入 `prisma.config.ts` 中而不是 schema.prisma 中直接用 env()。
   - pgvector 在 Prisma 中无原生 vector 字段支持，存储和语义余弦距离搜索 (`<=>`) 需要使用 `$executeRaw` 和 `$queryRaw`。

3. **数据库与端口**：
   - 本地 PG 冲突，Docker Compose 中 PostgreSQL 显式映射到 **5433** 端口，dev 运行绑定至 **3001** 端口。

---

## CRI 业务重构开发计划（CRI Roadmap）

> 核心目标：每天完成一个明确的 CRI 业务增量，将产品形态彻底改造为 B2B 客户智能工作台。

### Day 8 — CRI 数据模型与 API 层构建
* **任务**：
  - 修改 `schema.prisma`，新增 CRI 业务表：`Organization`（企业工作区）、`Customer`（客户主体）、`Lead`（销售线索）、`Interaction`（沟通记录）、`CustomerSignal`（风险/意向结构化信号）、`Recommendation`（AI建议）、`HumanReview`（人工确认记录）、`Outcome`（ROI结果复盘）。
  - 执行 `pnpm prisma db push` 写入 PG5433。
  - 编写 API Routes：`/api/customers`（列表与详情）、`/api/leads`、`/api/interactions`。
  - 用 Zod 运行时校验替换 Chat API 以及新增 API 的类型断言，统一错误处理响应。

### Day 9 — CRI 客户/线索工作台 UI
* **任务**：
  - 新建 `/customers` 页面作为系统默认 Landing 主入口，提供表格与卡片视图，展示客户生命周期阶段、意向等级与风险信号。
  - 设计 `/customers/[id]` 360 度客户详情页基础框架，呈现左侧客户画像与右侧沟通历史时间线。
  - sidebar.tsx 重构：将「客户工作台」置于顶部首位，将 `/chat` 对话功能降级为「Agent调试台」。

### Day 10 — CRI AI 分析引擎与人工审批闭环
* **任务**：
  - 新增 `src/lib/cri/analyzer.ts`，聚合客户基础信息、Interaction 记录与 SOP 知识库，调用 ReAct Agent 引擎。
  - 开发 `/api/customers/[id]/analyze` 接口，自动生成结构化建议：画像摘要、意向评分、风险来源、下一步任务建议、邮件/话术草稿、是否应转人工。
  - 在客户详情页集成 AI 建议面板与证据引用卡片。
  - 实现「人工审核面板」：支持业务员一键采纳（创建本地任务）、修改话术或驳回，保存 HumanReview 记录，形成结果回写。

### Day 11 — CRI Dashboard ROI 业务看板重构
* **任务**：
  - 改造 `/api/stats`，替换原先纯 Token 统计为 CRI 业务指标：总分析客户数、风险客户比例、可挽回商机 Pipeline（未跟进金额 × 转化概率）、AI建议采纳率、节省工时（分析次数 × 基准时间）。
  - 重构 `/dashboard`，将 Token 图表折叠/移至次要栏，主视觉展示 ROI 指标、14天线索响应 SLA 改善趋势图、流失风险成因饼图。

### Day 12 — Seed 数据、移动端适配与工程打磨
* **任务**：
  - 新增 `prisma/seed-cri.ts`，预置 6-10 条具有真实感、涵盖各阶段（B2B SaaS / 企业服务）的客户、沟通纪要与 SOP 模板，确保 clone 后开箱即可演示闭环。
  - 完成全局移动端响应式适配：Sidebar 在小屏下支持抽屉式拉出，客户工作台在窄屏下以卡片堆叠流呈现。
  - 补充 CI 配置，建立基础的 lint 与编译自动化防御机制。

### Day 13 — 安全防护加固与 Bearer Token 开放 API
* **任务**：
  - 开启 Redis sliding window 频率限制：对 Chat 调试端及分析接口进行每用户限频，对注册接口按 IP 进行小时限频，防恶意刷单。
  - 引入 react-markdown 配合 rehype-sanitize 进行 XSS 防御，对 API Key 及敏感字段进行前端脱敏（首尾保留，中间加密/打码）。
  - 实现开放 API：新建 `OpenApiToken` 表，允许企业生成 `sk-opencat-` 令牌，增加 API 鉴权中间件以支持第三方脚本/系统调用分析能力。

### Day 14 — CRM 外部接入与 MCP 通道准备
* **任务**：
  - 新增 `/api/customers/import` 接口，支持 CSV 文件快速导入线索数据。
  - 提供 Mock CRM Sync 服务，模拟与主流 CRM（如 Salesforce / HubSpot）的数据双向同步，当人工采纳建议时模拟创建 CRM Task 和写回 Note。
  - 实现极简 MCP Client（`src/lib/mcp/client.ts`），利用 MCP stdio/SSE 协议将外部数据库或 CRM 数据源转化为 Agent 可检索工具。

---

## 关键文件索引
* `prisma/schema.prisma`           → 数据库 Schema（15表 + CRI新增表）
* `src/lib/agent/react-engine.ts`  → 自研 ReAct Agent 引擎
* `src/lib/llm/registry.ts`        → 多模型 Gateway 工厂
* `src/lib/memory/rag.ts`          → RAG 知识分块检索管道
* `src/app/api/chat/route.ts`      → SSE 对话流式接口 (调试端)
* `src/components/layout/sidebar.tsx` → 系统导航侧边栏
* `src/app/(dashboard)/dashboard/page.tsx` → 业务 ROI 看板

---

## 明确不做
1. 不使用第三方 Agent 框架（如 LangChain / AutoGPT），保证自研引擎代码高可控性。
2. MVP 阶段不实现真实 CRM OAuth（用 CSV 导入与 Mock CRM API 代替，降本增效）。
3. AI 绝不进行任何自动外发沟通（如自动发邮件、自动改 CRM 状态），必须由人工在详情页确认/修改后手动触发或写回。
4. 放弃 Tauri 原生桌面端等边缘特性的深入定制，UI 优先保浏览器 B 端交互体验。
