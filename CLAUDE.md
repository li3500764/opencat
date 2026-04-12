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
- **AI SDK**: Vercel AI SDK 6.x (@ai-sdk/openai, @ai-sdk/anthropic)
- **状态管理**: Zustand
- **桌面端**: Tauri 2.0（计划 Day 7 接入，代码复用 95%+）
- **部署**: Docker Compose

## 开发计划（1周）
| Day | 目标 | 状态 |
|-----|------|------|
| Day 1 | 脚手架 + 认证 + DB | ✅ 完成 |
| Day 2 | 单模型对话 + SSE 流式 | ✅ 完成 |
| Day 3 | 多模型 Gateway + API Key 管理 | 🔲 下一步 |
| Day 4 | Tool Calling + ReAct Agent 引擎 | 🔲 |
| Day 5 | 多 Agent 编排 + 项目隔离 | 🔲 |
| Day 6 | Memory 系统 + RAG 知识库 | 🔲 |
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
src/stores/chat.ts             → Zustand 对话列表状态管理
src/components/chat/chat-panel.tsx    → 聊天主面板（useChat + transport）
src/components/chat/chat-input.tsx    → 输入框（自管理 input 状态）
src/components/chat/message-list.tsx  → 消息列表（自动滚底）
src/components/chat/message-item.tsx  → 单条消息（Markdown 渲染）
src/components/chat/markdown.tsx      → Markdown → HTML 渲染器
src/components/layout/sidebar.tsx     → 侧边栏（对话列表 + 新建 + 删除）
src/app/api/auth/[...nextauth] → NextAuth API 路由
src/app/api/auth/register      → 注册 API
src/app/api/chat/route.ts      → Chat 流式 API（AI SDK 6.x）
src/app/api/conversations/route.ts    → 对话列表 + 删除 API
src/app/api/conversations/[id]/messages/route.ts → 历史消息 API
src/app/(auth)/login            → 登录页
src/app/(auth)/register         → 注册页
src/app/(dashboard)/layout.tsx  → Dashboard 布局（Server → Client Sidebar）
src/app/(dashboard)/chat/page.tsx      → 新对话页面
src/app/(dashboard)/chat/[id]/page.tsx → 已有对话页面
src/app/globals.css             → 设计系统（暖灰+琥珀）
.env                            → 环境变量（DATABASE_URL 端口 5433）
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
