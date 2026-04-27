# OpenCat 项目面试题集

> 用于"AI应用开发工程师"岗位面试准备。每个问题包含：**回答要点**（背核心思路）+ **加分项**（体现深度）。

---

## 一、项目概述类

### Q1：介绍一下你做的这个 OpenCat 项目

**回答要点：**
- OpenCat 是一个**类 OpenAI 的 AI Agent 编排平台**，7 天全栈开发完成
- 核心功能：多模型 LLM Gateway、ReAct Agent 引擎、多 Agent 编排（Orchestrator）、Memory 自动记忆、RAG 知识库、Token 计费 Dashboard
- 技术栈：Next.js 16 + TypeScript + PostgreSQL 17 (pgvector) + Redis + Vercel AI SDK 6.x + Tauri 2.0 桌面端
- 设计原则：**不用 LangChain**，自研 Agent Runtime，体现对底层原理的理解

**加分项：**
- 这个项目是面向简历"AI应用开发工程师"岗位准备的，所以技术选型和架构设计都以"能讲清原理"为目标
- 15 张数据库表，覆盖了用户认证、API Key 管理、Agent 配置、对话持久化、Memory、RAG 文档分块、用量计费等完整业务链路

---

### Q2：为什么不用 LangChain，要自己写 Agent Runtime？

**回答要点：**
- LangChain 封装太深，面试时说"用了 LangChain"很难证明你理解底层原理
- 自研可以完全掌控：ReAct 循环怎么实现、Tool Calling 怎么流转、Memory 怎么注入，每一层都清楚
- Vercel AI SDK 6.x 提供了足够好的底层抽象（`streamText`、`tool()`、`stepCountIs`），在此之上自研成本可控

**加分项：**
- 实际上 Vercel AI SDK 本身就是一个很好的中间层——它负责和各家 LLM API 的协议对接，我专注在 Agent 业务逻辑上
- 自研的 ReAct Agent 引擎只有不到 100 行核心代码，但能支持 Tool Calling、Orchestrator、Memory 注入等高级功能

---

## 二、技术选型类

### Q3：为什么选 Next.js 而不是纯前端 + 独立后端？

**回答要点：**
- Next.js 的 App Router 天然支持全栈开发，API Route 和页面在同一体项目中
- SSE 流式响应在 Next.js 中用 `Response` 对象直接实现，不需要额外框架
- Serverless 友好，后续可以部署到 Vercel 或自建 Docker

**加分项：**
- 用到了 App Router 的路由分组 `(dashboard)` 实现鉴权守卫布局
- Chat API 的流式返回用 `toUIMessageStreamResponse()` 配合 `ReadableStream` 实现，前端 `useChat` 自动消费

---

### Q4：为什么用 Prisma 7？有什么坑？

**回答要点：**
- Prisma 7 是最新版本，类型安全好，Schema 定义清晰
- 用了 `adapter-pg` 模式（client engine + pg Pool），不是传统的二进制引擎
- 踩过几个坑：
  1. `schema.prisma` 里 datasource URL 要移到 `prisma.config.ts` 里写
  2. 默认 client 引擎需要手动构造 pg Pool + adapter，不能直接 `new PrismaClient()`
  3. `vector` 类型字段要用 `Unsupported("vector(1536)")` 声明，ORM 无法直接操作，必须用 `$executeRaw` / `$queryRaw` 写原始 SQL

**加分项：**
- pgvector 的向量相似度搜索用 `<=>` 余弦距离运算符，这是 Prisma 不原生支持的，所以必须用 `$queryRaw` 拼 SQL
- 批量插入 DocumentChunk 时，用模板字符串拼接多个 `(gen_random_uuid(), $1, $2, $3::vector)` 批量执行

---

### Q5：为什么用 PostgreSQL + pgvector，而不是 Pinecone / Milvus 等向量数据库？

**回答要点：**
- 项目规模不大，没必要引入额外的向量数据库服务
- pgvector 作为 PostgreSQL 扩展，和主数据库统一运维，降低复杂度
- 余弦相似度搜索（`<=>`）对于千级别的数据量性能完全够用

**加分项：**
- 如果数据量到百万级，会考虑专门向量数据库或 pgvector 的 IVFFlat / HNSW 索引
- 当前方案的优势是事务一致性——文档删除时级联删除 chunk，在同一数据库事务里完成

---

## 三、架构设计类

### Q6：说说整体架构是怎么设计的？

**回答要点：**

```
前端层：Next.js App Router + Zustand 状态管理 + TailwindCSS
        ↓
API 层：/api/chat（流式对话）、/api/agents（Agent CRUD）、
        /api/keys（API Key 管理）、/api/stats（Dashboard 聚合）
        ↓
业务层：lib/llm/（Provider 抽象 + createModel）
        lib/tools/（Tool Registry + 内置工具）
        lib/agent/（ReAct Agent Engine）
        lib/memory/（Embedding + Memory Store + RAG）
        ↓
数据层：Prisma 7 + PostgreSQL 17 (pgvector) + Redis 7
```

**分层原则：**
- `lib/` 下按业务域组织（llm、tools、agent、memory），每个域有 types / 核心实现 / index 导出
- API Route 只做参数校验和路由，业务逻辑全在 `lib/` 里
- Zustand store 只管前端状态，不掺和业务逻辑

**加分项：**
- Provider 抽象层的设计是"注册表 + 工厂函数"模式：`createModel(modelId, apiKey, format)` 根据 format 动态创建 AI SDK 的 LanguageModel 实例，外部调用方不需要知道底层是 OpenAI 还是 Anthropic

---

### Q7：Provider 抽象层是怎么设计的？

**回答要点：**
- 三层结构：`types.ts` 定义接口 → `registry.ts` 注册表 + 工厂 → `index.ts` 统一导出
- 核心是 `createModel()` 工厂函数，接收 `modelId + apiKey + format + baseUrl`，返回 AI SDK 的 `LanguageModel` 实例
- 引入 **ApiFormat** 类型区分四种协议：`openai`（Chat Completions）、`openai-responses`、`anthropic`、`google-genai`
- 为什么需要 format？因为 AI SDK 6.x 的 `createOpenAI()` 默认走 Responses API（`/responses` 端点），但 DeepSeek / 代理平台等第三方只支持 Chat Completions（`/chat/completions`），必须用 `.chat(modelId)` 调用

**加分项：**
- `openai-responses` 格式 + 自定义 baseUrl 时，`createModel()` 会自动降级为 `.chat()`——因为代理平台不支持 Responses API
- 费用计算 `calculateCost()` 也在注册表里，每个模型配置了 input/output 单价，调用后自动计算花费

---

### Q8：API Format 架构是什么？为什么需要？

**回答要点：**
- AI SDK 6.x 有四种 API 协议格式：
  - `openai`：Chat Completions（`/chat/completions`），兼容 DeepSeek / 代理平台
  - `openai-responses`：Responses API（`/responses`），仅 OpenAI 官方
  - `anthropic`：Anthropic Messages API
  - `google-genai`：Google Generative AI
- 不同 Provider 的 API Key 需要标记它支持哪种 format
- 用户可以在 Settings 页面手动选择 format，系统会根据 Provider 自动推荐默认值

**加分项：**
- 这个设计解决了"同一个 OpenAI 兼容接口，有的走 Responses、有的走 Chat Completions"的协议差异问题
- Chat API 里从 `userKey.format` 读取格式传给 `createModel()`，确保走正确的协议

---

## 四、核心实现类

### Q9：ReAct Agent 引擎是怎么实现的？

**回答要点：**
- 核心文件 `lib/agent/react-engine.ts`，`createAgentStream()` 函数封装了 `streamText`
- 流程：接收消息 → 转换 model messages → 调用 `streamText({ model, messages, tools, stopWhen: stepCountIs(maxSteps) })` → SSE 流式返回
- `stopWhen: stepCountIs(N)` 控制最大步数，防止 Agent 无限循环
- 支持 `_systemPromptSuffix` 字段，用于注入 Memory / RAG 检索到的上下文

**加分项：**
- AI SDK 6.x 的 `maxSteps` 参数已移除，改用 `stopWhen: stepCountIs(N)` 作为终止条件
- Tool Calling 的多步循环是 AI SDK 内部自动处理的——`streamText` 发现工具调用后会自动执行工具、把结果放回 messages 继续生成，直到没有工具调用或达到 maxSteps

---

### Q10：Tool Calling 的完整流程是什么？

**回答要点：**
1. **工具定义**：`tools/types.ts` 定义 `ToolDefinition`（name / description / inputSchema Zod / execute 函数）
2. **工具注册**：`tools/registry.ts` 的 `registerTool()` 将工具注册到全局 Map
3. **格式转换**：`toAISDKTools()` 把自定义 ToolDefinition 转成 AI SDK 的 `tool()` 格式
4. **执行流程**：
   - LLM 生成工具调用 → AI SDK 解析出 tool name + args
   - 通过 Tool Registry 查找对应工具的 execute 函数
   - 执行并返回结果 → AI SDK 将结果放回 messages 继续生成
5. **UI 展示**：`ToolCallCard` 组件渲染 `ToolUIPart`，展示工具名 / 输入参数 / 执行结果 / 状态（loading/success/error）

**加分项：**
- 工具调用的 state 生命周期：`input-streaming` → `input-available` → `output-available` / `output-error`
- UIMessage.parts 中工具调用的 type 格式：静态工具 `"tool-{name}"`，动态工具 `"dynamic-tool"`

---

### Q11：Orchestrator 多 Agent 编排是怎么做的？

**回答要点：**
- 核心是 `call_agent` 内置工具，定义在 `tools/builtin/call-agent.ts`
- `createCallAgentTool()` 工厂函数根据运行时子 Agent 列表动态创建工具定义
- Agent Engine 升级：`createAgentStream()` 新增 `subAgents` 参数，自动注册 `call_agent` 工具
- 当 Orchestrator Agent 决定调用子 Agent 时，用 `generateText()`（非流式）执行子 Agent 任务，结果返回给 Orchestrator 继续决策

**加分项：**
- 子 Agent 调用是同步的（generateText 等待完成），不是流式的——因为 Orchestrator 需要拿到完整结果才能继续下一步决策
- Agent 管理页面可以配置 Orchestrator 开关，选择这个 Agent 是"主编排者"还是"子执行者"

---

### Q12：RAG 系统的完整流程？

**回答要点：**
1. **文档上传**：前端上传 `.txt` / `.md` 文件 → API 接收 → 存入 Document 表
2. **分块处理**：`lib/memory/rag.ts` 用滑动窗口策略（500 字符窗口 / 50 重叠 / 句子边界感知）将文档分成多个 chunk
3. **批量向量化**：用 AI SDK 的 `embedMany()` 一次性处理所有 chunk（比逐个 `embed()` 快很多），生成 1536 维向量
4. **存储**：通过 `$executeRaw` 批量插入 DocumentChunk 表（含 embedding 向量字段）
5. **检索**：对话前用 `<=>` 余弦距离运算符做相似度搜索，取 top-K 最相似的 chunk
6. **注入**：检索结果拼接到系统提示词后缀（`_systemPromptSuffix`），作为上下文注入对话

**加分项：**
- 分块的滑动窗口策略需要处理句子边界——用正则匹配句号 / 感叹号 / 问号作为边界点，避免在句子中间断开
- 向量存储用了 Prisma 的 `$queryRaw` + `SET embedding = $1::vector` 语法，因为 Prisma ORM 不原生支持 vector 类型

---

### Q13：Memory 系统是怎么工作的？

**回答要点：**
- `lib/memory/store.ts`：Memory Store 管理用户记忆的存取
- 两个内置工具：`memory_save`（Agent 自主保存用户信息）和 `memory_search`（语义搜索记忆）
- 流程：用户说话 → Agent 判断是否需要记忆 → 调用 `memory_save` → 向量化存入 Memory 表
- 对话前：自动检索相关记忆（向量相似度搜索），注入系统提示词

**加分项：**
- Memory 和 RAG 的区别：Memory 是 Agent 在对话过程中自主决定的（"记住这个用户偏好"），RAG 是用户上传的文档知识库（"从这些文档中找相关内容"）
- 两者都用了相同的向量化存储和检索机制，只是数据来源不同

---

## 五、难点踩坑类

### Q14：AI SDK 6.x 踩了哪些坑？

**回答要点：**
1. **类型变化**：`Message` → `UIMessage`，内容从 `content` 字符串变成 `parts` 数组
2. **useChat 变化**：不再提供 `input` / `handleSubmit` / `isLoading`，改用 `sendMessage({ text })` + `status` 判断状态
3. **transport 替代 api**：`api` 选项被移除，改用 `transport`（`DefaultChatTransport`）
4. **maxSteps 移除**：改用 `stopWhen: stepCountIs(N)` 控制步数
5. **Responses API vs Chat Completions**：`createOpenAI()` 默认走 `/responses`，第三方平台必须用 `.chat()` 走 `/chat/completions`
6. **StreamTextResult 异步**：`.text` / `.totalUsage` / `.steps` 都是 `PromiseLike`，需要 await
7. **Zod v4**：`z.record()` 需要两个参数，不能只传一个

**加分项：**
- 这些踩坑经历说明我深入使用了最新版本的 SDK，不是只调用过时的 API
- 服务端响应从 `toDataStreamResponse()` 改为 `toUIMessageStreamResponse()`，也是 6.x 的变化

---

### Q15：pgvector 怎么用？有什么注意事项？

**回答要点：**
- 安装 `pgvector` 扩展：`CREATE EXTENSION vector;`
- Schema 中声明：`embedding Unsupported("vector(1536)")`
- 向量插入用 `$executeRaw`：`INSERT INTO "Memory" (embedding) VALUES ($1::vector)`
- 相似度搜索用 `<=>` 运算符：`SELECT * FROM "Memory" ORDER BY embedding <=> $1::vector LIMIT 5`
- 值越小越相似（余弦距离）

**加分项：**
- 批量向量化用 `embedMany()` 而非逐个 `embed()`，效率提升显著
- Prisma 7 的 `Unsupported()` 类型是"透传"声明——Prisma 知道这个字段存在但不操作它，必须用原始 SQL 处理

---

### Q16：流式响应是怎么实现的？

**回答要点：**
- 服务端：`streamText()` 返回 `StreamTextResult` → `toUIMessageStreamResponse()` 转为 `Response` 对象
- 底层是 `ReadableStream` + SSE（Server-Sent Events）协议
- 前端：`useChat()` 的 `transport` 自动消费 SSE 流，逐 token 更新 UI
- 消息持久化用 fire-and-forget 模式——不等流结束，后台异步保存

**加分项：**
- 流式响应的优势：用户不需要等待完整生成就能看到内容，体验接近 ChatGPT
- fire-and-forget 的设计：调用 `result.text`（PromiseLike）在后台 then 中保存到 DB，不阻塞响应

---

## 六、性能优化类

### Q17：Dashboard 的聚合查询怎么优化的？

**回答要点：**
- `/api/stats` 接口用 `Promise.all` 并行查询 7 项数据（概览、Token 配额、每日用量、模型统计、最近活动等）
- 每日用量用原生 SQL `GROUP BY DATE` 聚合，缺失日期自动补零
- 模型统计用 `GROUP BY model, provider` 聚合 token 数和花费
- 最后统一将 `bigint` 转 `number`，返回单一 JSON 响应

**加分项：**
- 用 `Promise.all` 而不是串行 await，7 个查询同时发起，响应时间取决于最慢的那个查询
- 前端用 `useEffect + fetch` 一次性拿到所有数据，避免多次请求

---

### Q18：批量向量化怎么做的？

**回答要点：**
- 用 AI SDK 的 `embedMany({ model, values: chunks })` 一次性处理所有 chunk
- 比逐个 `embed()` 快很多——减少网络往返次数
- 得到向量数组后，用 `$executeRaw` 批量插入数据库

**加分项：**
- 如果文档很大（比如 10 万字符），分块后可能有几百个 chunk，批量向量化的优势更明显
- 可以考虑分批处理（比如每 100 个 chunk 一批），避免单次请求超时

---

## 七、部署运维类

### Q19：Docker 部署方案是怎样的？

**回答要点：**
- `Dockerfile` 多阶段构建：base → deps → builder → runner，四个阶段
- 运行时用非 root 用户，健康检查配置
- `docker-compose.prod.yml` 编排三个服务：app（3000）+ postgres（pgvector，内部 5432）+ redis（内部 6379）
- 内部网络 `internal`，只暴露 app:3000 端口

**加分项：**
- `.dockerignore` 排除 node_modules / src-tauri / .git 等，减少构建上下文
- `.env.production.example` 提供生产环境变量模板（数据库 / 认证 / 加密 / LLM / Embedding）

---

### Q20：Tauri 桌面端是怎么集成的？

**回答要点：**
- Tauri 2.0 用 Rust WebView 容器，前端代码 95%+ 复用
- `tauri.conf.json` 配置窗口：1200×800 默认，最小 900×600，居中打开
- dev 模式：`devUrl` 指向 `localhost:3001`（复用 Next.js dev server）
- build 模式：`next.config.ts` 支持 `TAURI=1` 静态导出 + `STANDALONE=1` standalone 模式
- 最终打包生成 `.dmg` / `.exe` / `.AppImage`

**加分项：**
- Tauri 的优势是体积小（相比 Electron），因为用系统 WebView 而不是打包 Chromium
- `next.config.ts` 做了三种模式适配：标准开发 / Tauri 静态导出 / standalone 生产

---

## 八、亮点差异化类

### Q21：这个项目最大的亮点是什么？

**回答要点（选 2-3 个说）：**
1. **自研 ReAct Agent Runtime**——不用 LangChain，从 0 实现 Agent 引擎，理解底层原理
2. **API Format 抽象层**——解决 OpenAI Responses / Chat Completions / Anthropic / Google 四种协议的统一适配
3. **RAG 全链路**——从文档上传到分块、向量化、检索、注入，完整实现
4. **Orchestrator 多 Agent 编排**——主 Agent 通过 Tool Calling 调度子 Agent
5. **纯 SVG 手绘图表**——Dashboard 零第三方图表库依赖

**加分项：**
- 这些技术点都可以展开讲实现细节，说明不是"调包侠"，而是真正理解原理

---

### Q22：如果让你再做一遍，会有什么改进？

**回答要点：**
1. **认证**：加入 RBAC 角色权限控制（当前只有用户级认证）
2. **流式保存**：当前 fire-and-forget 可能丢失消息，改为流结束后确认保存
3. **向量索引**：数据量大后加 pgvector 的 HNSW 索引提升检索速度
4. **缓存层**：Redis 目前未充分利用，可以加 API 响应缓存 / 会话缓存
5. **测试**：补充单元测试和集成测试（当前为快速开发未覆盖）
6. **多模态**：支持图片 / 语音等多模态输入

**加分项：**
- 能说出改进方向说明对系统有全局认知，不是"写完就不管了"

---

## 九、快速复习卡片（面试前背）

### 数据库 15 张表
`User` | `Account` | `Session` | `VerificationToken` | `ApiKey` | `Project` | `Agent` | `Conversation` | `Message` | `Tool` | `Memory` | `KnowledgeBase` | `Document` | `DocumentChunk` | `UsageLog`

### 5 个内置工具
`calculator` | `datetime` | `http_request` | `call_agent` | `memory_save` + `memory_search`

### 4 种 API Format
`openai`（Chat Completions） | `openai-responses` | `anthropic` | `google-genai`

### AI SDK 6.x 关键变化
- `Message` → `UIMessage`（parts 数组）
- `useChat` 无 `input/handleSubmit` → 用 `sendMessage({ text })`
- `maxSteps` → `stopWhen: stepCountIs(N)`
- `api` → `transport`（DefaultChatTransport）
- `toDataStreamResponse` → `toUIMessageStreamResponse`

### 核心文件路径
```
lib/llm/registry.ts        → Provider 注册表 + createModel
lib/tools/registry.ts      → Tool Registry + toAISDKTools
lib/agent/react-engine.ts  → ReAct Agent Engine
lib/memory/rag.ts          → RAG 分块 + 向量化 + 检索
lib/memory/store.ts        → Memory Store
app/api/chat/route.ts      → Chat 流式 API
```
