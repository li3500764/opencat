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
| Day 7 | Dashboard + Tauri 打包 + 部署 | 🔲 |

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
