# OpenCat - AI Agent Platform

## 项目定位
类 OpenCow 的开源 AI Agent 编排平台。核心功能：多模型 LLM Gateway、多 Agent 编排（Orchestrator 模式）、ReAct Agent 引擎 + Tool Calling、Memory 自动记忆 + RAG 知识库、项目隔离 + Agent 配置、Token 计费 + Dashboard、用户认证 + API Key 管理。

**故意不用 LangChain**，自研 Agent Runtime 以体现原理理解（面试差异化）。

## 技术栈
- **框架**: Next.js 16 (App Router) + TypeScript
- **UI**: TailwindCSS + Geist 字体（设计风格：暖灰+琥珀色，**禁止紫色/AI渐变风**）
- **ORM**: Prisma 7（client engine + @prisma/adapter-pg + pg Pool）
- **数据库**: PostgreSQL 17 (pgvector) + Redis 7（Docker Compose，PG 映射到 **5433** 端口，因为本地有 PG14 占了 5432）
- **认证**: NextAuth.js v5 (Auth.js)，JWT session，GitHub OAuth + 邮箱密码
- **AI SDK**: Vercel AI SDK 6.x (@ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google)
- **状态管理**: Zustand
- **桌面端**: Tauri 2.0（计划 Day 7 接入，代码复用 95%+）
- **部署**: Docker Compose

## 开发计划（1周）
| Day | 目标 | 状态 |
|-----|------|------|
| Day 1 | 脚手架 + 认证 + DB | ✅ 完成 |
| Day 2 | 单模型对话 + SSE 流式 | ✅ 完成 |
| Day 3 | 多模型 Gateway + API Key 管理 | ✅ 完成 |
| Day 4 | Tool Calling + ReAct Agent 引擎 | ✅ 完成 |
| Day 5 | 多 Agent 编排 + 项目隔离 | ✅ 完成 |
| Day 6 | Memory 系统 + RAG 知识库 | ✅ 完成 |
| Day 7 | Dashboard + Tauri 打包 + 部署 | ✅ 完成 |

## Day 1 完成内容
- [x] Next.js 16 + TypeScript + TailwindCSS 脚手架（pnpm）
- [x] Prisma 7 Schema：15 张表（User, Account, Session, VerificationToken, ApiKey, Project, Agent, Conversation, Message, Tool, Memory, KnowledgeBase, Document, DocumentChunk, UsageLog）
- [x] Docker Compose：PostgreSQL 17 (pgvector, 端口 5433) + Redis 7 (6379)
- [x] pgvector 扩展已启用（Memory 和 RAG 的向量检索用）
- [x] Prisma Client 单例 + pg.Pool adapter（src/server/db/index.ts）
- [x] NextAuth v5 配置（GitHub OAuth + Credentials，JWT session）
- [x] 注册 API（/api/auth/register，Zod 校验 + bcrypt hash）
- [x] 登录/注册页面 UI（干净中性风格，猫图标）
- [x] Dashboard 布局（侧边栏 + 鉴权守卫）
- [x] Chat 占位页面
- [x] AES-256-GCM 加密工具（src/lib/crypto.ts，用于存储用户 API Key）
- [x] 测试用户已创建：test@opencat.dev / password123

## Day 2 完成内容
- [x] Chat API Route（/api/chat）— 接收 UIMessage，convertToModelMessages 转换，streamText 流式返回
- [x] AI SDK 6.x 适配 — UIMessage parts 格式、toUIMessageStreamResponse、DefaultChatTransport
- [x] Chat UI 组件 — MessageList + MessageItem + ChatInput + Markdown 渲染
- [x] 对话持久化 — 用户消息和 AI 回复自动存 Message 表，用量记录到 UsageLog
- [x] 自动建对话 — 首次发消息自动创建 Default Project + Conversation
- [x] Zustand 状态管理 — useChatStore 管理对话列表和当前活跃对话
- [x] 侧边栏 — 对话列表（实时刷新）、新建对话、删除对话、登出、当前对话高亮
- [x] 已有对话加载 — /chat/[id] 路由，从 DB 加载历史消息转 UIMessage 格式
- [x] Conversations API — GET /api/conversations（列表）+ DELETE（删除）
- [x] Messages API — GET /api/conversations/[id]/messages（历史消息）
- [x] 新增依赖：@ai-sdk/react、react-markdown、remark-gfm
- [x] TypeScript 编译零错误，Next.js build 通过

## Day 3 计划（下一步）
1. 多模型 Gateway — 支持 OpenAI / Anthropic / 自定义 Provider，统一调用接口
2. API Key 管理页面 — 添加/删除/测试用户的 LLM API Key（AES 加密存储）
3. 模型选择器 — 对话时可切换模型
4. Provider 抽象层 — src/lib/llm/ 下实现可插拔的 Provider 架构

## AI SDK 6.x 踩坑记录
1. `Message` 类型改名为 `UIMessage`，内容不再是 `content` 字符串，而是 `parts` 数组
2. `useChat` 不再提供 `input` / `handleInputChange` / `handleSubmit` / `isLoading`
3. 用 `sendMessage({ text })` 发消息，用 `status`（'ready'|'submitted'|'streaming'|'error'）判状态
4. `api` 选项被移除，改用 `transport`（DefaultChatTransport / TextStreamChatTransport）
5. 服务端返回用 `toUIMessageStreamResponse()` 而不是 `toDataStreamResponse()`
6. `convertToModelMessages()` 返回 Promise，需要 await
7. Usage 字段：`inputTokens` / `outputTokens`（不是 `promptTokens` / `completionTokens`）
8. 自定义 fetch + transport.body 函数可以实现请求拦截和动态参数注入

## Day 3 完成内容
- [x] Provider 抽象层（src/lib/llm/）— types + registry + createModel()，可插拔架构
- [x] 模型注册表 — OpenAI（5 模型）+ Anthropic（2 模型）+ DeepSeek（2 模型），含价格
- [x] createModel() — 根据 modelId + apiKey 动态创建 AI SDK LanguageModel 实例
- [x] DeepSeek / Custom Provider 走 OpenAI 兼容接口
- [x] API Key 管理 API — POST/GET /api/keys（增查）+ DELETE/POST /api/keys/[id]（删/测试）
- [x] API Key 加密存储 — 用 Day 1 的 AES-256-GCM，解密后调 LLM
- [x] Key 测试功能 — POST /api/keys/[id] 发一个极短请求验证 Key 是否有效
- [x] Settings 页面 — /settings，API Key 管理 UI（添加/删除/测试/按 Provider 分类）
- [x] 模型选择器组件 — 下拉菜单，按 Provider 分组，显示价格，对话顶栏可切换
- [x] Chat API 改造 — 支持 modelId 参数，优先用户 Key → 回退 .env Key
- [x] 费用计算 — calculateCost() 按模型单价折算，存入 UsageLog.cost
- [x] 侧边栏加 Settings 入口（🔑 图标）
- [x] 新增依赖：无（复用已有 @ai-sdk/openai, @ai-sdk/anthropic）

## Day 4 计划（下一步）
1. Tool 定义 + JSON Schema 校验 — 工具注册、inputSchema 验证
2. ReAct Agent 引擎 — 思考→行动→观察循环，maxSteps 防无限循环
3. 内置工具 — web_search、calculator、code_interpreter 等
4. Tool Calling UI — 展示工具调用过程（调了什么工具、参数、结果）

## Day 4 完成内容
- [x] Tool 类型系统（src/lib/tools/types.ts）— ToolDefinition / ToolExecutionResult / ToolExecutionContext / RegisteredTool
- [x] 内置工具 3 个：calculator（安全数学计算）、datetime（当前时间/格式化/日期差值）、http_request（外部 API 调用，超时+截断保护）
- [x] Tool Registry 注册中心（src/lib/tools/registry.ts）— 注册/注销/启用禁用/按名查找，核心方法 toAISDKTools() 转换成 AI SDK 格式
- [x] ReAct Agent Engine（src/lib/agent/react-engine.ts）— createAgentStream() 封装 streamText + tools + stopWhen
- [x] AI SDK 6.x 适配：maxSteps 已被替换为 stopWhen: stepCountIs(N)，tool() 是 identity function
- [x] Chat API 改造（Day 4 版）— 接入 Agent Engine，新增 enableTools / toolNames 参数，fire-and-forget 后台保存
- [x] Tool Calling UI — message-item.tsx 支持渲染 ToolUIPart，展示工具调用的输入参数和执行结果
- [x] ToolCallCard 组件 — 可折叠卡片，显示工具名/状态图标(loading/success/error)/输入参数/输出结果
- [x] Tools API — GET /api/tools 返回所有已注册工具的名称、描述、类型、启用状态
- [x] TypeScript 编译零错误，Next.js build 通过

## AI SDK 6.x Tool Calling 踩坑记录
1. `maxSteps` 参数已移除，改用 `stopWhen: stepCountIs(N)`（import { stepCountIs } from "ai"）
2. `tool()` 函数是 identity function（原样返回），但 TS 类型重载极严格，泛型架构下直接构造对象更可靠
3. `StreamTextResult` 的属性（.text, .totalUsage, .steps）都是 `PromiseLike`，需要 await 获取最终值
4. UIMessage.parts 中工具调用的 type 格式：静态工具 "tool-{name}"，动态工具 "dynamic-tool"
5. 工具调用 state 生命周期：input-streaming → input-available → output-available / output-error
6. Zod v4 的 `z.record()` 需要两个参数：z.record(z.string(), z.string())，不能只传一个

## Day 5 完成内容
- [x] Agent CRUD API — GET/POST /api/agents（列表+创建）+ GET/PUT/DELETE /api/agents/[id]（详情/更新/删除）
- [x] Agent 管理页面 /settings/agents — 卡片列表 + 创建/编辑表单（名称/描述/系统提示词/模型/温度/步数/工具选择/Orchestrator 开关）
- [x] AgentSelector 组件 — 对话顶栏下拉选择 Agent，支持 Default（无 Agent）+ 自定义 Agent 列表
- [x] ChatPanel 集成 — 新增 agentId 状态，通过 transport body 传给 Chat API
- [x] Chat API 改造（Day 5 版）— 接受 agentId，加载 Agent 配置覆盖默认值（systemPrompt/tools/maxSteps/model），Conversation 关联 agentId
- [x] Orchestrator Agent — call_agent 内置工具，Orchestrator 可通过 Tool Calling 调用子 Agent（generateText 非流式执行）
- [x] createCallAgentTool 工厂函数 — 根据运行时子 Agent 列表动态创建 call_agent 工具定义
- [x] Agent Engine 升级 — createAgentStream 新增 subAgents 参数，自动注册 call_agent 工具
- [x] Default Project API — GET /api/projects/default，自动创建用户的 Default 项目
- [x] 侧边栏新增 Agents 入口（Bot 图标 → /settings/agents）
- [x] TypeScript 编译零错误，Next.js build 通过

## Day 6 计划（下一步）
1. Memory 系统 — Agent 自动记忆关键信息（用户偏好、上下文）
2. RAG 知识库 — 文档上传 → 分块 → pgvector 向量存储 → 语义检索
3. Memory + RAG 集成到对话流程 — 自动注入相关上下文

## Day 6 完成内容
- [x] Embedding Service（src/lib/memory/embedding.ts）— OpenAI text-embedding-3-small，1536 维向量
- [x] Memory Store（src/lib/memory/store.ts）— 向量化存储 + 语义检索 + CRUD，pgvector 余弦相似度搜索
- [x] RAG 系统（src/lib/memory/rag.ts）— 文档分块（滑动窗口 500 字符/50 重叠/句子边界感知）→ 批量向量化 → 存储 DocumentChunk → 相似度检索
- [x] Memory 工具（src/lib/tools/builtin/memory.ts）— memory_save（Agent 自主保存用户信息）+ memory_search（语义搜索记忆）
- [x] Tool Registry 注册 memory_save + memory_search 两个新工具
- [x] Chat API 集成 Memory + RAG（/api/chat）— 每次对话前自动检索相关记忆和知识库文档，注入系统提示词后缀
- [x] Agent Engine 升级（react-engine.ts）— 新增 _systemPromptSuffix 字段，自动拼接 Memory/RAG 上下文到系统提示词
- [x] KnowledgeBase API（/api/knowledge）— 知识库 CRUD（创建/列表/删除，级联删除 Document + Chunk）
- [x] Document Upload API（/api/knowledge/[id]/documents）— 支持 JSON 和 FormData 上传，自动触发 RAG 处理流程
- [x] Memory API（/api/memory）— 用户记忆列表 + 删除
- [x] Knowledge Base 管理页面（/settings/knowledge）— 创建/删除知识库、上传 .txt/.md 文档、查看文档列表和分块状态
- [x] 侧边栏新增 Knowledge Base 入口（Database 图标 → /settings/knowledge）
- [x] ToolCallCard 新增 memory_save / memory_search / call_agent 的中文显示名和配色
- [x] **API Format 架构** — ApiFormat 类型（openai / openai-responses / anthropic / google-genai），Provider 注册表按格式区分 API 协议
- [x] **Google Gemini Provider** — 新增 @ai-sdk/google，支持 Gemini 2.5 Flash/Pro、2.0 Flash 三个模型
- [x] **createModel() 重构** — 根据 format 而非 providerId 选择创建方式，openai-responses 配自定义 baseUrl 时自动降级为 chat completions
- [x] **ApiKey format 字段** — Schema 新增 format 字段，Settings 页面支持选择 API 格式（自动根据 Provider 推荐）
- [x] **API Key 编辑功能** — PUT /api/keys/[id]，Settings 页面新增编辑按钮（修改 provider/format/label/baseUrl/apiKey）
- [x] **Chat API format 传递** — 从 userKey.format 读取格式，传递给 createModel() 确保走正确的 API 协议
- [x] TypeScript 编译零错误，Next.js build 通过

## pgvector + RAG 踩坑记录
1. Prisma 7 不原生支持 vector 类型字段的读写，需要用 `$executeRaw` / `$queryRaw` 进行原始 SQL 操作
2. Memory 表的 embedding 字段用 `Unsupported("vector(1536)")` 声明，Prisma ORM 的 create/findMany 无法操作该字段
3. 向量相似度搜索用 `<=>` 余弦距离运算符（pgvector 提供），值越小越相似
4. 批量向量化用 AI SDK 的 `embedMany()` 一次性处理所有 chunk，效率远高于逐个 `embed()`
5. 文档分块的滑动窗口策略需要处理句子边界，避免在句子中间断开
6. DocumentChunk 的 embedding 同样是 `Unsupported("vector(1536)")`，存储时用 `$executeRaw`

## AI SDK 6.x API Format 踩坑记录
1. AI SDK 6.x 的 `createOpenAI()(modelId)` 默认走 Responses API（`/responses` 端点），只有 OpenAI 官方支持
2. DeepSeek、代理平台等第三方必须用 `.chat(modelId)` 走 Chat Completions（`/chat/completions`）
3. 因此引入 `ApiFormat` 类型区分四种 API 协议：`openai`（Chat Completions）、`openai-responses`、`anthropic`、`google-genai`
4. `openai-responses` 格式 + 自定义 baseUrl 时自动降级为 `.chat()` — 因为代理平台不支持 Responses API
5. ApiKey 表新增 `format` 字段，用户可在 Settings 页手动选择（Provider 切换时自动推荐默认格式）

## Prisma 7 踩坑记录
1. schema.prisma 里 datasource 不能写 url = env()，要移到 prisma.config.ts 的 datasource.url
2. 默认 "client" 引擎需要 @prisma/adapter-pg + pg 连接池，不能直接 new PrismaClient()
3. PrismaClient 构造器不支持 datasourceUrl 参数
4. pnpm 需要在 package.json 的 pnpm.onlyBuiltDependencies 里加 @prisma/engines, @prisma/client, prisma

## 关键文件索引
```
prisma/schema.prisma          → 数据库 Schema（15 表）
prisma.config.ts               → Prisma 7 数据库连接配置
docker-compose.yml             → PG + Redis 容器
src/server/db/index.ts         → Prisma Client 单例 + pg Pool
src/lib/auth.ts                → NextAuth v5 配置
src/lib/crypto.ts              → AES-256-GCM 加解密
src/lib/utils.ts               → cn() TailwindCSS 工具
src/lib/llm/types.ts           → Provider/Model 类型定义
src/lib/llm/registry.ts        → Provider 注册表 + createModel() + calculateCost()
src/lib/llm/index.ts           → LLM 模块统一导出
src/lib/tools/types.ts         → Tool 类型定义（ToolDefinition/ToolExecutionResult/RegisteredTool）
src/lib/tools/registry.ts      → Tool Registry 注册中心（注册/查找/转 AI SDK 格式）
src/lib/tools/index.ts         → Tools 模块统一导出
src/lib/tools/builtin/calculator.ts   → 内置工具：安全数学计算
src/lib/tools/builtin/datetime.ts     → 内置工具：日期时间（now/format/diff）
src/lib/tools/builtin/http-request.ts → 内置工具：HTTP API 调用
src/lib/tools/builtin/index.ts        → 内置工具统一导出
src/lib/tools/builtin/call-agent.ts   → 内置工具：Orchestrator 子 Agent 调用（Day 5）
src/lib/tools/builtin/memory.ts       → 内置工具：memory_save + memory_search（Day 6）
src/lib/memory/embedding.ts    → Embedding 服务（向量生成 + 向量搜索）（Day 6）
src/lib/memory/store.ts        → Memory Store（记忆存取 + 语义检索）（Day 6）
src/lib/memory/rag.ts          → RAG 系统（分块 + 文档处理 + 检索）（Day 6）
src/lib/memory/index.ts        → Memory 模块统一导出（Day 6）
src/lib/agent/react-engine.ts  → ReAct Agent Engine（createAgentStream + stopWhen + Orchestrator + Memory/RAG suffix）
src/lib/agent/index.ts         → Agent 模块统一导出
src/stores/chat.ts             → Zustand 对话列表状态管理
src/stores/theme.ts            → Zustand 主题状态（light/dark）
src/components/chat/chat-panel.tsx    → 聊天主面板（useChat + 模型选择）
src/components/chat/chat-input.tsx    → 输入框
src/components/chat/message-list.tsx  → 消息列表
src/components/chat/message-item.tsx  → 单条消息
src/components/chat/markdown.tsx      → Markdown 渲染器
src/components/chat/model-selector.tsx → 模型下拉选择器
src/components/chat/agent-selector.tsx → Agent 下拉选择器（Day 5）
src/components/layout/sidebar.tsx     → 侧边栏
src/components/layout/theme-provider.tsx → 主题初始化
src/components/layout/theme-toggle.tsx   → 主题切换按钮
src/app/api/chat/route.ts             → Chat 流式 API（多模型）
src/app/api/conversations/route.ts    → 对话列表 + 删除
src/app/api/conversations/[id]/messages/route.ts → 历史消息
src/app/api/keys/route.ts             → API Key 增查
src/app/api/keys/[id]/route.ts        → API Key 删除 + 测试
src/app/api/tools/route.ts            → GET 可用工具列表
src/app/api/agents/route.ts           → Agent 列表 + 创建
src/app/api/agents/[id]/route.ts      → Agent 详情 + 更新 + 删除
src/app/api/knowledge/route.ts        → KnowledgeBase CRUD（Day 6）
src/app/api/knowledge/[id]/documents/route.ts → 文档上传 + 列表（Day 6）
src/app/api/memory/route.ts           → Memory 列表 + 删除（Day 6）
src/app/api/projects/default/route.ts → 获取/创建默认项目
src/app/(dashboard)/settings/page.tsx  → Settings / API Key 管理页
src/app/(dashboard)/settings/agents/page.tsx → Agent 管理页（Day 5）
src/app/(dashboard)/settings/knowledge/page.tsx → Knowledge Base 管理页（Day 6）
src/app/(dashboard)/chat/page.tsx      → 新对话页面
src/app/(dashboard)/chat/[id]/page.tsx → 已有对话页面
src/app/globals.css                    → 设计系统（light/dark 双主题）
.env                                   → 环境变量
```

## 开发环境
- **系统**: macOS
- Node 22 / pnpm 10 / Docker Desktop
- 本地有 PG14 占 5432，Docker PG 用 **5433**
- dev server 跑在 **3001**（3000 被其他进程占了）
- 启动命令：`docker compose up -d && pnpm dev`

## 用户要求
- **全程经手**：代码 AI 写但用户要完全理解每一层架构和代码作用
- **不要 AI 味**：禁止紫色渐变、深紫配色，走干净克制的工具感风格
- **简历导向**：这个项目是为了简历"AI应用开发工程师"岗位准备的
- **不用 LangChain**：自研 Agent Runtime，面试时能讲清原理
- **Tauri 桌面端**：Web + 桌面双端，代码复用 95%+

## Day 7 完成内容
- [x] Stats API（/api/stats）— 单接口返回全部仪表盘数据（Promise.all 并行查询）
- [x] 概览聚合 — 总对话/消息/Token/花费/Agent/知识库/记忆数量
- [x] Token 配额 — 用量/额度/百分比/Plan 信息
- [x] 14 天每日用量 — 原生 SQL GROUP BY DATE 聚合，缺失日期自动补零
- [x] 模型分组统计 — 按 model+provider GROUP BY，token 数 + 花费 + 调用次数
- [x] 最近活动 — 最近 20 条调用记录（模型/Provider/Token/花费/时间）
- [x] Dashboard 页面（/dashboard）— 4 个统计卡片 + Token 配额进度条 + 折线图 + 环形图 + 活动表格
- [x] StatCard 组件 — 统计卡片（数值 + 标签 + 副标题 + 图标）
- [x] LineChart 组件 — 纯 SVG 折线图（面积渐变 + Y 轴刻度 + Hover Tooltip），不依赖第三方图表库
- [x] DonutChart 组件 — 纯 SVG 环形图（strokeDasharray 弧形 + 中心总量 + 图例列表 + Hover 交互）
- [x] ActivityTable 组件 — 调用记录表格（Provider 彩色标签 + 相对时间 + Token 格式化）
- [x] 侧边栏新增 Dashboard 入口（BarChart3 图标 → /dashboard），对话列表上方固定位置
- [x] Tauri 2.0 桌面端配置 — src-tauri/ 完整目录结构（tauri.conf.json + Cargo.toml + main.rs + lib.rs + build.rs）
- [x] Tauri 窗口配置 — 1200×800 默认尺寸，最小 900×600，居中打开
- [x] Tauri devUrl 指向 localhost:3001（复用 Next.js dev server）
- [x] next.config.ts 改造 — 支持 TAURI=1 静态导出 + STANDALONE=1 standalone 模式 + 默认标准模式
- [x] package.json 新增 tauri:dev / tauri:build 脚本
- [x] @tauri-apps/cli + @tauri-apps/api 依赖安装
- [x] Dockerfile 多阶段构建 — base → deps → builder → runner，非 root 用户，健康检查
- [x] docker-compose.prod.yml — App + PostgreSQL (pgvector) + Redis，内部网络隔离，数据持久化
- [x] .dockerignore — 排除 node_modules/src-tauri/.git 等无关文件
- [x] .env.production.example — 生产环境变量模板（数据库/认证/加密/LLM/Embedding）
- [x] TypeScript 编译零错误，Next.js build 通过

## Day 7 架构说明

### Dashboard 数据流
```
/api/stats → Promise.all 并行查询 7 项数据
           → 原生 SQL (dailyUsage, modelBreakdown) + Prisma ORM (其余)
           → bigint → number 转换 + 14天日期补零
           → 单一 JSON 响应

/dashboard → useEffect + fetch('/api/stats')
           → 4 × StatCard + TokenQuota 进度条
           → LineChart (SVG polyline + polygon gradient)
           → DonutChart (SVG circle strokeDasharray)
           → ActivityTable (相对时间 + Provider 标签)
```

### Tauri 2.0 架构
```
pnpm tauri:dev → 启动 Rust WebView → 加载 http://localhost:3001
                                    → 前端完全复用 Next.js（代码复用 95%+）
pnpm tauri:build → Next.js export → Tauri bundle → .dmg/.exe/.AppImage
```

### Docker 生产部署
```
docker compose -f docker-compose.prod.yml up -d --build
  → postgres (pgvector/pgvector:pg17)  内部 5432
  → redis (redis:7-alpine)             内部 6379
  → app (Dockerfile 多阶段)            对外 3000
  → 内部网络 internal，只暴露 app:3000
```

## 关键文件索引（Day 7 新增）
```
src/app/api/stats/route.ts                → Dashboard Stats API（聚合查询）
src/app/(dashboard)/dashboard/page.tsx     → Dashboard 页面
src/components/dashboard/stat-card.tsx     → 统计卡片组件
src/components/dashboard/line-chart.tsx    → SVG 折线图组件
src/components/dashboard/donut-chart.tsx   → SVG 环形图组件
src/components/dashboard/activity-table.tsx → 活动表格组件
src/components/dashboard/index.ts          → Dashboard 组件统一导出
src-tauri/tauri.conf.json                  → Tauri 窗口/构建配置
src-tauri/Cargo.toml                       → Rust 依赖
src-tauri/src/main.rs                      → Rust 入口
src-tauri/src/lib.rs                       → Tauri 核心库
src-tauri/build.rs                         → Tauri 构建脚本
Dockerfile                                 → 多阶段生产构建
docker-compose.prod.yml                    → 生产编排（App+PG+Redis）
.dockerignore                              → Docker 构建排除
.env.production.example                    → 生产环境变量模板
next.config.ts                             → 多模式输出配置
```

## 项目完成总结

### 7 天开发成果
| 功能模块 | 技术实现 |
|----------|---------|
| 用户认证 | NextAuth v5 + JWT + GitHub OAuth + 邮箱密码 |
| 多模型 Gateway | OpenAI + Anthropic + DeepSeek + Google Gemini，可插拔 Provider |
| 对话系统 | SSE 流式 + Vercel AI SDK 6.x + 对话持久化 |
| API Key 管理 | AES-256-GCM 加密存储 + 多 Provider 支持 |
| ReAct Agent | 自研引擎（非 LangChain）+ stopWhen 步数控制 |
| Tool Calling | 5 个内置工具 + Tool Registry + ToolCallCard UI |
| 多 Agent 编排 | Orchestrator 模式 + call_agent 子 Agent 调度 |
| Memory 系统 | 向量化记忆 + 语义检索 + pgvector 余弦相似度 |
| RAG 知识库 | 文档上传 → 滑动窗口分块 → Embedding → 向量存储 → 检索注入 |
| Dashboard | Stats API + SVG 手绘图表（折线图/环形图）+ 活动表格 |
| 桌面端 | Tauri 2.0 配置，Web + Desktop 双端复用 |
| 生产部署 | Docker 多阶段构建 + Compose 编排 |

### 技术栈全景
```
前端: Next.js 16 + React 19 + TypeScript + TailwindCSS 4 + Zustand
后端: Next.js API Routes + Prisma 7 + PostgreSQL 17 (pgvector) + Redis 7
AI:   Vercel AI SDK 6.x + 自研 ReAct Agent Runtime + RAG Pipeline
桌面: Tauri 2.0 (Rust)
部署: Docker + Docker Compose
```

---

## Phase 2-4: 功能增强 → 生产加固 → 桌面端深度

> 目标：从"能用"进化到"好用 + 安全 + 原生桌面体验"。
> 原则：**每天做一个可感知的大功能**，完成后当天能看到效果。不搞花架子，不做用户用不到的东西。
> 精简原则：砍掉了 Agent 可视化（DAG 算法太复杂用户不看）、社区市场（没用户量）、Webhook/Swagger（不是 API 平台）、全局快捷键/剪贴板监听（锦上添花）。

## 开发计划总览

| Day | 目标 | 阶段 | 状态 |
|-----|------|------|------|
| Day 8 | Provider 开放式重构 + Markdown 增强 | Phase 2 | ⏳ |
| Day 9 | 图片上传/多模态 + 文件附件 | Phase 2 | ⏳ |
| Day 10 | Web Search + Thinking 展示 + 流式停止 | Phase 2 | ⏳ |
| Day 11 | Prompt 模板 + 消息编辑/重试 + 对话搜索 + 导出 | Phase 2 | ⏳ |
| Day 12 | Artifacts 分屏渲染（简化版） | Phase 2 | ⏳ |
| Day 13 | MCP 协议支持 | Phase 2 | ⏳ |
| Day 14 | Preset 角色 + 移动端响应式 + 开源打磨 | Phase 3 | ⏳ |
| Day 15 | Rate Limiting + 安全加固 | Phase 3 | ⏳ |
| Day 16 | Bearer Token 开放 API | Phase 3 | ⏳ |
| Day 17 | 桌面端：系统托盘 + 通知 + 自动更新 | Phase 3 | ⏳ |
| Day 18 | 桌面端：Ollama 本地模型 + 离线可用 | Phase 4 | ⏳ |

---

## Day 8 — Provider/Model 开放式架构重构 + Markdown 增强

### Part 1: Provider/Model 架构重构

#### 为什么先做这个？
> 当前的 Provider 和模型列表是硬编码的，用户无法添加自己的第三方 API 和模型。
> 这完全违背了"开放"的原则。改为用户自配置后，任何兼容 OpenAI/Anthropic/Google 协议的
> 第三方服务（如 DeepSeek、硅基流动、零一万物、月之暗面等）都能无缝接入。

#### 核心思路
```
旧架构: 硬编码 PROVIDERS[] → 静态模型列表 → createModel() 查注册表
新架构: 用户配置 Provider（协议+Key+URL+模型数组） → 动态读取 → createModel() 直传参数
```

#### 要做的事
- [ ] **Prisma Schema 改造** — ApiKey 表新增 `models` JSON 字段，存储模型数组
  - 教学点：为什么用 JSON 而不是单独建表？因为模型列表是跟着 Provider 走的，不需要独立关联查询
- [ ] **LLM types.ts 重写** — 删除 `ProviderInfo`，新增 `UserProviderConfig` / `UserModelInfo`
  - 新增 `SUGGESTED_MODELS` — 按协议类型分组的预设模型建议，方便用户快速添加
- [ ] **LLM registry.ts 重写** — 删除硬编码 `PROVIDERS` 数组
  - `createModel()` 简化为直接接受 format + apiKey + baseUrl
  - `calculateCost()` 改为直接接受 inputPrice/outputPrice 参数
- [ ] **新增 /api/models 接口** — 聚合用户所有 Provider 下的模型，返回扁平列表
  - 教学点：从 ApiKey 表读取 models JSON，展开为 `UserModelInfo[]`
- [ ] **Settings 页面重写** — 支持每个 Provider 管理多个模型
  - 添加 Provider 时选择协议类型 → 自动推荐常用模型 → 用户可增删改模型
  - 每个模型可配置：ID、显示名、输入/输出价格
- [ ] **ModelSelector 组件重写** — 从 /api/models 动态获取，按 Provider 分组展示
  - 去掉对静态 PROVIDERS 的依赖
- [ ] **Chat API 改造** — 根据 modelId 动态查找对应的 Provider 配置
  - 从用户所有 Provider 的 models 中匹配 modelId → 获取 apiKey + format + baseUrl
- [ ] **Key 测试接口改造** — 使用用户配置的第一个模型测试，而非硬编码测试模型

### Part 2: Markdown 渲染增强

- [ ] **代码语法高亮** — 引入 shiki，支持 50+ 语言的语法着色
  - 教学点：shiki 用的是 VS Code 的 TextMate 语法，渲染结果和编辑器一致
- [ ] **代码块一键复制按钮** — 右上角 Copy 按钮 + 复制成功动画（✓ 勾）
- [ ] **LaTeX 数学公式** — 引入 remark-math + rehype-katex
- [ ] **Mermaid 流程图** — 检测 ```mermaid 代码块，用 mermaid.js 实时渲染成 SVG
- [ ] **消息操作栏** — 每条 AI 消息底部增加：复制全文 / 重新生成 按钮

### Part 3: API 入参校验（顺手做）

- [ ] **Chat API Zod 校验** — 用 Zod schema 校验请求体，替换当前的 `as {}` 类型断言
  - 教学点：运行时校验 vs 编译时类型断言的区别——断言只是骗 TypeScript，Zod 才是真的在检查
- [ ] **统一 API 错误响应** — 抽一个 `apiError(code, message)` 工具函数，所有 Route 统一调用

### 依赖变更
```
新增：shiki、remark-math、rehype-katex、mermaid
```

---

## Day 9 — 图片上传/多模态 + 文件附件

### 为什么做这个？
> GPT-4o、Claude 3.5 Sonnet、Gemini 2.5 都支持 Vision（图片理解）。
> 用户没法发图片给 AI，等于浪费了一半的模型能力。

### 要做的事
- [ ] **图片上传 UI** — ChatInput 增加图片上传按钮（📎 图标），支持：
  - 点击选择文件（accept="image/*"）
  - 拖拽上传（drag & drop）
  - 粘贴上传（Ctrl+V 直接粘贴剪贴板图片）
  - 教学点：FileReader.readAsDataURL() vs createObjectURL()
- [ ] **图片预览** — 上传后在输入框上方显示缩略图，可删除
- [ ] **图片转 Base64 发送** — 将图片编码为 data URI，通过 AI SDK 的 multimodal 消息格式发送
  - 教学点：AI SDK 6.x 的 `{ type: "image", image: base64 }` 消息 part
- [ ] **Chat API 适配** — 服务端处理包含图片的消息，传给支持 Vision 的模型
  - 教学点：不同模型的图片支持差异（OpenAI 用 image_url，Anthropic 用 source）
- [ ] **消息中图片渲染** — message-item.tsx 支持渲染图片类型的 part
- [ ] **文件上传 API** — POST /api/upload，处理文件上传，存储到 public/uploads/
  - 文件大小限制 10MB，类型白名单（.txt/.md/.pdf/.png/.jpg）
- [ ] **RAG 文档上传增强** — Knowledge Base 页面支持拖拽上传 + PDF 解析（pdf-parse）
  - 教学点：PDF 解析的原理——提取文本层，不处理扫描件
- [ ] **[桌面端] 原生文件选择器** — `isTauri()` 判断环境，桌面端用 `@tauri-apps/plugin-dialog` 调原生文件对话框，Web 端用 `<input type="file">`
  - 教学点：Tauri 环境检测 + 平台分支模式（`isTauri() ? nativeDialog() : webInput()`）

### 依赖变更
```
新增：pdf-parse（PDF 文本提取）、@tauri-apps/plugin-dialog（桌面端文件选择）
```

---

## Day 10 — Web Search + Thinking 过程展示 + 流式停止

### 为什么做这个？
> AI 的训练数据有截止日期。没有搜索能力的 AI 回答"今天天气"只能靠编。
> Web Search 是最能体现 Agent 价值的工具——让 AI 能主动去互联网查信息。

### 要做的事
- [ ] **Web Search 内置工具** — src/lib/tools/builtin/web-search.ts
  - 接入 Tavily API（免费版每月 1000 次）或 SearXNG（自托管、完全免费）
  - 工具功能：接收查询词 → 返回搜索结果摘要（标题+URL+snippet）
  - 教学点：为什么不直接 Google？Google Custom Search API 贵且有配额限制
- [ ] **URL 内容抓取工具** — src/lib/tools/builtin/url-reader.ts
  - 给 Agent 一个 URL，自动抓取页面内容（去 HTML 标签、提取正文）
  - 教学点：cheerio 的 DOM 解析 vs readability 算法
- [ ] **Thinking 过程展示（Reasoning Traces）** — 当 AI 处于思考阶段时：
  - 显示"正在思考..."的动态指示器
  - 支持展开查看 AI 的思考步骤（reasoning 内容）
  - 适配 DeepSeek R1 / Claude 的 thinking 输出
  - 教学点：AI SDK 6.x 的 `reasoning` part type
- [ ] **流式思考动画** — 思考过程实时流式显示（类似 ChatGPT o1 的折叠区域）
  - 半透明背景 + 等宽字体 + 逐字出现动画
- [ ] **流式停止按钮（Stop）** — 流式输出时，输入框旁的发送按钮变为停止按钮
  - 调用 AI SDK 的 `stop()` 方法立即中断流式传输
  - 教学点：AbortController 的取消机制——前端 abort → 服务端 stream 中断
- [ ] **工具注册** — 将 web_search 和 url_reader 注册到 Tool Registry
- [ ] **ToolCallCard 适配** — 新增 web_search / url_reader 的配色和图标

### 依赖变更
```
新增：cheerio（HTML 解析）
环境变量：TAVILY_API_KEY（可选，不配置则不启用搜索工具）
```

---

## Day 11 — Prompt 模板 + 消息编辑/重试 + 对话搜索 + 导出

### 为什么做这个？
> "不知道怎么提问"是普通用户最大的痛点。
> 内置一套高质量 Prompt 模板，能极大降低使用门槛。

### 要做的事
- [ ] **Prompt 模板库 UI** — 新建对话的空白页面（chat welcome screen）改造
  - 展示预设的 Prompt 卡片（如：代码审查、文章翻译、日报总结、面试辅助...）
  - 点击卡片直接填充到输入框并发送
  - 教学点：模板的数据结构设计——支持分类、支持参数占位符
- [ ] **Prompt 模板数据** — src/lib/prompts/templates.ts，内置 10-15 个高质量模板
  - 分类：编程开发、写作创作、学习辅助、工作效率、分析思考
- [ ] **对话标题自动生成** — 首次对话后，用 AI 自动生成一个简短的对话标题
  - 教学点：用一个极简的 generateText 调用（模型用最便宜的 nano），避免"New Chat"泛滥
- [ ] **消息编辑 & 重新发送** — 用户可以编辑自己之前发送的消息
  - 点击编辑 → 消息变为可编辑文本框 → 确认后从该消息处重新发送
  - 教学点：编辑消息后需要截断该消息之后的所有消息
- [ ] **一键重试（Regenerate）** — AI 消息的操作栏增加"重新生成"按钮
  - 重新发送上一条用户消息，替换当前 AI 回复
- [ ] **切换模型重试** — 重新生成时可选择不同模型
  - 教学点：这个功能在做模型对比测试时非常有用
- [ ] **对话搜索** — 侧边栏增加搜索框，支持按标题搜索对话
  - 教学点：前端过滤 vs 后端 API 搜索的取舍
- [ ] **对话导出** — 对话详情菜单增加"导出"按钮，支持导出为 Markdown / JSON
  - 纯前端实现（不需要新 API），遍历当前对话的 messages 数组拼接即可
  - 教学点：Blob + URL.createObjectURL + a.download 的前端文件下载模式
- [ ] **[桌面端] 原生保存对话框** — 导出时 `isTauri()` 走 `dialog.save()` 弹出系统"另存为"，Web 端走浏览器下载

---

## Day 12 — Artifacts 分屏渲染（简化版）

### 为什么做这个？
> Claude 的 Artifacts 是它的杀手级功能——AI 生成代码后直接渲染成可预览的组件。
> 这个功能会给你的开源项目带来极高的 Star 转化率。

### 简化策略
> 先只做 HTML 代码块预览 + Mermaid 图表，不做 React 组件渲染和 CSV 表格。
> 最小版本先跑通分屏架构，后续再迭代更多类型。

### 要做的事
- [ ] **Artifacts 检测** — 从 AI 回复中识别可渲染的内容块
  - 检测规则：HTML 代码块、Mermaid 图表（先用这两种）
  - 教学点：用正则从 Markdown 中提取结构化块
- [ ] **分屏渲染面板** — 聊天界面右侧弹出预览面板
  - HTML 代码 → iframe 沙盒渲染
  - Mermaid → SVG 图表
  - 教学点：iframe sandbox 的安全策略——`sandbox="allow-scripts"` 阻止访问父页面
- [ ] **Artifact 列表** — 面板顶部显示当前对话的所有 Artifact，点击切换
- [ ] **Artifact 操作** — 每个 Artifact 卡片底部：复制代码 / 下载文件 / 全屏预览
- [ ] **[桌面端] Artifact 本地保存** — 下载时走原生保存对话框

---

## Day 13 — MCP 协议支持

### 为什么做这个？
> MCP（Model Context Protocol）是 Anthropic 提出的开放协议，
> 让 AI 能连接外部数据源和工具。这已经成为 AI 应用的标配。
> 支持 MCP = 你的平台能接入成千上万的社区工具（数据库、日历、文件系统...）。

### 要做的事
- [ ] **MCP Client 实现** — src/lib/mcp/client.ts
  - 实现 MCP 协议的 stdio 和 SSE 两种传输方式
  - 连接 MCP Server → 发现工具列表 → 调用工具
  - 教学点：MCP 协议的请求/响应格式，JSON-RPC 2.0
- [ ] **MCP Server 管理 UI** — /settings/mcp 页面
  - 添加/删除 MCP Server 配置（名称、命令/URL、环境变量）
  - 显示连接状态和可用工具列表
  - 教学点：SSE vs stdio transport 的区别和适用场景
- [ ] **MCP 工具注册** — 连接 MCP Server 后，自动将其工具注册到 Tool Registry
  - 工具类型标记为 `mcp`
  - 教学点：动态注册 vs 静态注册的架构区别
- [ ] **侧边栏新增 MCP 入口** — 图标 → /settings/mcp

### 依赖变更
```
新增：@modelcontextprotocol/sdk（MCP 官方 SDK）
```

---

## Day 14 — Preset 角色 + 移动端响应式 + 开源打磨

### 为什么做这个？
> 做两件事：让产品"好用"（移动端 + 预设角色）和"想 Star"（开源生态基础设施）。

### 要做的事（产品功能）
- [ ] **Preset 角色系统** — 内置多个预设 Agent 角色
  - "代码助手"、"翻译官"、"写作教练"、"数据分析师"等
  - 用户点击即用，无需自己配置 System Prompt
  - 数据存储在 src/lib/agents/presets.ts
- [ ] **移动端响应式适配** — 当前侧边栏是固定宽度，小屏完全不可用
  - 侧边栏改为可折叠/抽屉式（手机端从左侧滑出）
  - 聊天界面在窄屏下占满全宽
  - 输入框底部固定
  - 教学点：Container Queries vs Media Queries 的现代方案

### 要做的事（开源生态）
- [ ] **LICENSE** — 创建 MIT License 文件（README 写了 MIT 但根目录没有文件，法律上等于没开源）
- [ ] **CONTRIBUTING.md** — 贡献指南（本地开发步骤、代码规范、PR 提交流程）
- [ ] **GitHub Actions CI** — .github/workflows/ci.yml（TypeScript 类型检查 + ESLint + Build）
  - 教学点：CI 最小化配置——只检查不部署
- [ ] **Seed 脚本** — prisma/seed.ts，填充示例数据（示例 Agent + 示例对话 + 示例 API Key）
  - 新用户 clone 下来跑 `pnpm db:seed` 就能看到效果，不至于面对空白页面
- [ ] **error.tsx + loading.tsx** — Next.js 全局错误边界 + 页面加载指示
  - 教学点：App Router 的 error boundary 机制——error.tsx 捕获子组件渲染错误
- [ ] **README 更新** — 修正 Roadmap 状态 + 添加项目截图 + Deploy to Vercel 按钮

---

## Day 15 — Rate Limiting + 安全加固

### 为什么做这个？
> 你的 Redis 装了但一直没用到。没有任何限流的 Chat API，
> 别人写个脚本就能无限调你的接口烧 Token。开源项目上线后第一个被打的就是这个。

### 要做的事
- [ ] **Chat API 限流** — Redis sliding window，每用户 20 次/分钟
  - 教学点：Redis sliding window vs fixed window vs token bucket 三种限流算法的区别
- [ ] **注册/登录限流** — 每 IP 5 次/小时，防暴力破解
- [ ] **文件上传安全** — 类型白名单 + 大小限制（10MB）+ 上传频率限制
- [ ] **Markdown XSS 防护** — 确认 react-markdown 配合 rehype-sanitize，防止恶意脚本注入
  - 教学点：XSS 攻击原理——Markdown 渲染时注入 `<script>` 或 `onerror` 事件
- [ ] **敏感信息脱敏** — Dashboard 和日志中的 API Key 只显示前 4 位 + ****
- [ ] **安全响应头** — 自定义 Next.js middleware 设置 X-Frame-Options / X-Content-Type-Options 等
  - 教学点：常见安全头的作用——CSP 防 XSS、X-Frame-Options 防点击劫持

### 依赖变更
```
新增：@upstash/ratelimit（或手写 Redis sliding window）
```

---

## Day 16 — Bearer Token 开放 API

### 为什么做这个？
> 当前所有 API 都靠 session cookie 认证，意味着只有浏览器里的用户能用。
> 加上 Bearer Token 后，第三方应用（脚本、IDE 插件、自动化工具）也能调你的 Agent。
> 这是从"产品"到"平台"的关键一步。

### 要做的事
- [ ] **Prisma Schema** — 新建 `OpenApiToken` 表（userId, tokenHash, name, permissions, expiresAt）
  - 教学点：为什么存 hash 不存明文？和存密码一个道理——数据库泄露了也不暴露 token
- [ ] **Token 生成 API** — POST /api/tokens，生成 `sk-opencat-{nanoid}` 格式的 token
  - 只在创建时显示一次完整 token，之后只能看到前 4 位
- [ ] **Token 认证中间件** — 提取中间件 `withBearerAuth()`，检查 `Authorization: Bearer sk-opencat-xxx`
  - 同时兼容 session cookie 和 Bearer Token，Web 用户走 cookie，第三方走 token
- [ ] **Token 管理页面** — /settings/tokens，创建/查看/撤销 API Token
- [ ] **Chat API 接入** — 第三方可以通过 POST /api/chat + Bearer Token 发消息给 Agent
  - 教学点：API 鉴权的分层——中间件统一拦截 vs 每个 Route 单独检查

---

## Day 17 — 桌面端深度：系统托盘 + 通知 + 自动更新

### 为什么做这个？
> 当前 Tauri 只是个空壳加载网页。这些系统级能力才是桌面端存在的意义。

### 要做的事
- [ ] **系统托盘（System Tray）** — 关闭窗口时最小化到托盘，不退出
  - 点击托盘图标重新弹出窗口
  - 右键菜单：新建对话 / 显示窗口 / 退出
  - 教学点：Tauri 的 `tray` 模块 + `Menu` API + 窗口 `hide()` vs `close()` 的区别
- [ ] **原生通知（Notifications）** — Agent 长时间任务跑完后弹系统通知
  - Token 超额时弹告警通知
  - 教学点：`tauri-plugin-notification` + Web Notification API 的区别
- [ ] **自动更新（Auto Update）** — 发布新版本后，启动时检测并提示更新
  - 配置 GitHub Releases 作为更新分发源
  - 教学点：`tauri-plugin-updater` + 签名密钥 + 更新 JSON 格式
- [ ] **开机自启动** — Settings 页面增加"开机自启动"开关
  - 教学点：`tauri-plugin-autostart` 在各平台的实现（macOS LaunchAgent / Windows Registry / Linux XDG）
- [ ] **Rust Command 通信** — 至少写一个 Tauri Command 实现 Rust ↔ JS 双向通信
  - 教学点：`#[tauri::command]` 宏 + `invoke()` 前端调用 + 序列化/反序列化

### 依赖变更
```
新增 Rust crate：tauri-plugin-notification、tauri-plugin-updater、tauri-plugin-autostart
新增 JS：@tauri-apps/plugin-notification、@tauri-apps/plugin-updater、@tauri-apps/plugin-autostart
```

---

## Day 18 — 桌面端深度：Ollama 本地模型 + 离线可用

### 为什么做这个？
> 这是桌面端对比 Web 端最大的优势——直接连本地 Ollama，无需 API Key，完全离线。
> Web 端跨域调 Ollama 很麻烦（CORS），桌面端没有这个限制。

### 要做的事
- [ ] **OllamaProvider** — 新增 Provider 类型，自动检测本地 `http://localhost:11434`
  - 调用 `/api/tags` 获取已安装模型列表
  - 教学点：Ollama 的 REST API 格式（和 OpenAI Chat Completions 基本兼容）
- [ ] **本地模型管理 UI** — Settings 页面新增 "Local Models" 区域
  - 显示已安装模型（名称、大小、最后使用）
  - 一键拉取新模型（调 `ollama pull`，显示进度条）
  - 教学点：Tauri Command 执行子进程 + 实时输出流（stdout streaming）
- [ ] **网络状态检测** — 检测在线/离线状态
  - 离线时自动推荐 Ollama 本地模型，上线后切回云端
  - 教学点：`tauri-plugin-os` + `navigator.onLine` + 事件监听
- [ ] **离线 fallback** — 云端 API 调用失败时，自动切换到本地 Ollama（如果可用）
  - 用户无感知，只弹个提示"已切换到本地模型"
- [ ] **本地知识库** — 桌面端知识库文档存在本地文件系统（`~/.opencat/knowledge/`）
  - 不依赖服务器，文档不出本机，适合私密数据
  - 教学点：`tauri-plugin-fs` 的文件读写 + 路径管理（appDataDir）

### 依赖变更
```
新增 Rust crate：tauri-plugin-shell（子进程）、tauri-plugin-fs（文件系统）、tauri-plugin-os（系统信息）
新增 JS：@tauri-apps/plugin-shell、@tauri-apps/plugin-fs、@tauri-apps/plugin-os
```

---

## Phase 2-4 架构总览

```
Phase 2 — 功能增强（Web 核心体验）
┌─────────────────────────────────────────────────────────────┐
│  Day 8:  Provider 重构 + Markdown 增强 + Zod 校验           │
│  Day 9:  多模态图片上传 + [桌面] 原生文件选择器             │
│  Day 10: Web Search + Thinking 展示 + 流式停止              │
│  Day 11: Prompt 模板 + 编辑/重试/搜索 + [桌面] 原生保存     │
│  Day 12: Artifacts 分屏渲染（简化版）                       │
│  Day 13: MCP 协议支持                                       │
└─────────────────────────────────────────────────────────────┘

Phase 3 — 生产加固 + 桌面端
┌─────────────────────────────────────────────────────────────┐
│  Day 14: Preset 角色 + 移动端 + 开源打磨（CI/Seed/错误边界）│
│  Day 15: Rate Limiting + 安全加固（Redis 终于用上了）       │
│  Day 16: Bearer Token 开放 API                              │
│  Day 17: [桌面] 系统托盘 + 通知 + 自动更新 + 开机自启       │
└─────────────────────────────────────────────────────────────┘

Phase 4 — 本地离线能力
┌─────────────────────────────────────────────────────────────┐
│  Day 18: [桌面] Ollama 本地模型 + 离线 fallback + 本地知识库│
└─────────────────────────────────────────────────────────────┘
```

## 学习路线图

| Day | 核心知识点 |
|-----|-----------|
| Day 8 | remark/rehype 插件链、shiki WASM 加载、Zod 运行时校验 vs TS 类型断言 |
| Day 9 | 浏览器 File API（FileReader/Blob/DataTransfer）、多模态消息协议、Tauri 环境检测 |
| Day 10 | Tavily 搜索 API、HTML→Text 提取（Readability）、AbortController 取消机制 |
| Day 11 | 消息数组不可变操作（截断/替换）、乐观更新 vs 悲观更新、Blob 文件下载 |
| Day 12 | iframe sandbox 安全模型、postMessage 通信 |
| Day 13 | MCP 协议（JSON-RPC 2.0）、stdio/SSE 双传输、动态工具注册 |
| Day 14 | GitHub Actions CI、Next.js error boundary、Prisma seed |
| Day 15 | Redis sliding window 限流、XSS/CSP 防护、OWASP 安全头 |
| Day 16 | Bearer Token 认证、Token hash 存储、API 鉴权中间件分层 |
| Day 17 | Tauri IPC（Rust↔JS invoke）、系统托盘生命周期、应用签名与更新分发 |
| Day 18 | 子进程管理（Command API）、Ollama REST API、离线优先架构、Tauri 文件系统 |

## 精简说明

### 砍掉了什么
| 功能 | 砍掉原因 |
|------|----------|
| Agent 可视化（DAG 拓扑图） | DAG 布局算法实现复杂，用户看完一次不会再看，投入产出比低 |
| 对话分享 / Agent 市场 / 社区模板 | 需要用户量才有意义，刚开源没人用，做了市场也没内容 |
| 团队协作 | 开源项目初期不需要，增加复杂度 |
| Webhook / Swagger | 不是 API 平台，终端用户不需要；手写 API 文档比配 Swagger 快 |
| 全局快捷键 / 剪贴板监听 | 酷但非核心，调试成本高 |
| 本地 SQLite 缓存 + 数据同步 | 离线缓存同步逻辑太复杂，有 Ollama 本地模式就够了 |
| HTTP 工具编辑器 UI | 单独一个可视化编辑器页面太重，MCP 本身就能扩展工具 |
| PWA 支持 | 桌面端不需要 PWA，Web 端优先级低，可以后面再加 |

### 为什么这些够用
- **功能完整度**：多模态、搜索、Artifacts、MCP — AI 应用该有的都有了
- **安全可用**：限流、XSS 防护、Bearer Token — 能放心部署到公网
- **桌面端差异化**：系统托盘 + Ollama 本地模型 — 这是大多数开源 AI 项目没有的
- **开源就绪**：LICENSE + CI + Seed + 贡献指南 — 别人 clone 下来能跑起来
