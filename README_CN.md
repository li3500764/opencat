<p align="center">
  <img src="./public/logo.png" width="120" alt="OpenCat logo" />
</p>

<h1 align="center">OpenCat</h1>

<p align="center">
  <strong>一个面向 Agent、知识库、工具和长任务的开源 AI 工作台</strong>
</p>

<p align="center">
  多模型对话 &nbsp;·&nbsp; ReAct 智能体 &nbsp;·&nbsp; Memory + RAG &nbsp;·&nbsp; 图像生成 &nbsp;·&nbsp; 用量分析
</p>

<p align="center">
  <a href="#亮点">亮点</a> &nbsp;&bull;&nbsp;
  <a href="#当前能力">当前能力</a> &nbsp;&bull;&nbsp;
  <a href="#系统架构">系统架构</a> &nbsp;&bull;&nbsp;
  <a href="#快速开始">快速开始</a> &nbsp;&bull;&nbsp;
  <a href="#项目结构">项目结构</a> &nbsp;&bull;&nbsp;
  <a href="#开发路线">开发路线</a> &nbsp;&bull;&nbsp;
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/pgvector-enabled-blue" />
  <img src="https://img.shields.io/badge/AI_SDK-6.x-000?logo=vercel" />
  <img src="https://img.shields.io/badge/Tauri-2-ffc131?logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

<p align="center">
  <a href="https://github.com/li3500764/opencat/stargazers">GitHub Stars</a> &nbsp;&bull;&nbsp;
  <a href="https://github.com/li3500764/opencat/network/members">Forks</a> &nbsp;&bull;&nbsp;
  <a href="https://github.com/li3500764/opencat/issues">Issues</a>
</p>

---

## 这是什么？

OpenCat 是一个**可自托管的 AI 工作台**，目标是把 Agent、知识库、工具调用、图像生成和运营分析放进同一个可扩展的开源产品里。

它已经不再只是一个简单的聊天 Demo。当前项目已经把这些能力组合在一起：

- **多模型对话**，模型来源于用户自己配置的 API Key
- **ReAct 风格 Agent**，支持工具调用和编排型子 Agent
- **Memory 与 RAG**，底层使用 PostgreSQL + pgvector
- **图像生成任务系统**，支持异步进度与结果展示
- **用量分析面板**，包含 token、成本、模型分布和活动流水
- **智能工作台 UI**，统一管理 Agent、知识库和后台任务

项目的重点是做一个透明、可修改、可自行部署的 AI 工作台，而不是把关键逻辑藏在厚重封装后面。

> **不靠魔法封装。** Agent 循环、工具系统、记忆检索和文档处理链路都在仓库里直接实现，便于你理解、扩展和重构。

---

## 亮点

- **真正可持久化的流式对话**，基于 SSE + PostgreSQL
- **用户级模型注册机制**，可用模型来自每个用户自己配置的 Provider 和模型列表
- **Agent 编排能力**，支持每个 Agent 独立配置 prompt、模型、工具和最大步骤数
- **Memory 注入**，在回答前自动检索相关记忆并拼接进系统提示词
- **RAG 知识库**，支持文档分块、向量化、pgvector 检索和上下文增强
- **内置工具体系**，已经覆盖计算、时间、HTTP、记忆、文档导出、金融查询和 Agent 间调用
- **异步任务工作流**，适合图像生成和知识处理这类长耗时任务
- **运营分析看板**，可以看 token 配额、成本趋势、模型占比和最近调用流水
- **中英文基础国际化**，代码中已经有 `en / zh` 两套文案基础

---

## 当前能力

### 工作台

- 基于 **NextAuth v5** 的登录与注册
- 支持 GitHub OAuth 和邮箱密码登录
- 新对话流程会自动创建默认项目
- 已有聊天、智能工作台、生图、设置、分析等主要页面

### 对话与 Agent

- 基于 SSE 的流式聊天
- 对话与消息持久化存储
- 每个 Agent 支持独立模型、系统提示词、温度、工具集和最大步数
- 编排型 Agent 可通过 `call_agent` 工具调度子 Agent
- 基于 Vercel AI SDK 的工具感知 Agent 运行时

### Memory 与知识库

- 长期记忆记录，支持分类和重要度
- 回答前自动检索相关记忆并注入上下文
- 知识库管理和文档导入
- 文本分块、Embedding、pgvector 相似度检索
- Embedding 不可用时有降级策略

### 工具系统

代码里当前已经导出的内置工具包括：

- `calculator`
- `datetime`
- `http_request`
- `memory_save`
- `memory_search`
- `call_agent`
- `property_match`
- `appointment`
- `stock_query`
- `market_news`
- `make_pdf`
- `make_word`
- `make_excel`
- `make_ppt`

### 图像生成

- 独立的图像生成页面
- 支持文生图和图生图
- 任务状态、进度、日志、结果预览完整可见
- 模型来源于用户自己配置的 API Key 和模型列表

### 分析看板

- Token 配额与消耗追踪
- API 总成本聚合
- 近 14 天 token、成本、消息量趋势图
- 模型用量占比分布
- 最近调用流水，展示 prompt / completion / total tokens 与成本

---

## 技术栈

| 层级 | 技术 |
|:-----|:-----|
| **框架** | Next.js 16 + React 19 |
| **语言** | TypeScript 5 |
| **样式** | Tailwind CSS 4 |
| **认证** | NextAuth v5 |
| **AI Runtime** | Vercel AI SDK 6.x |
| **数据库** | PostgreSQL 17 |
| **向量检索** | pgvector |
| **ORM** | Prisma 7 |
| **缓存 / 队列支撑** | Redis 7 |
| **桌面端** | Tauri 2 |
| **状态管理** | Zustand |
| **校验** | Zod 4 |
| **包管理** | pnpm 10 |

---

## 系统架构

```text
浏览器 / 桌面端 UI
  -> Next.js App Router 页面
  -> Chat、Smart Workspace、生图、设置、分析看板

应用层
  -> chat、agents、tools、knowledge、memory、keys、stats、tasks 等 API
  -> NextAuth 认证与用户隔离

AI Runtime
  -> 基于用户 API Key 的模型注册表
  -> ReAct 风格 Agent 流式执行
  -> 内置工具 + call_agent 编排
  -> memory 检索 + RAG 文档片段注入

数据层
  -> PostgreSQL 存储用户、项目、Agent、对话、知识、任务、日志
  -> pgvector 做语义检索
  -> Redis 负责缓存与后续队列类能力
```

### 核心数据域

Prisma Schema 现在已经远不止最初的聊天模型，主要数据域包括：

- `User`、`Account`、`Session`
- `ApiKey`
- `Project`
- `Agent`
- `Conversation`、`Message`
- `Tool`
- `Memory`
- `KnowledgeBase`、`Document`、`DocumentChunk`
- `BackgroundTask`
- `UsageLog`
- `Organization`、`Lead`、`CustomerInteraction` 等已经存在于项目中的业务实体

---

## 快速开始

### 前置要求

- Node.js 22+
- pnpm 10+
- Docker

### 1. 安装依赖

```bash
git clone https://github.com/li3500764/opencat.git
cd opencat
pnpm install
```

### 2. 启动本地服务

```bash
docker compose up -d
```

这会启动：

- PostgreSQL 17 + pgvector，端口 `5433`
- Redis 7，端口 `6379`

### 3. 配置环境变量

```bash
cp .env.example .env
```

至少需要配置：

```env
DATABASE_URL="postgresql://opencat:opencat@localhost:5433/opencat?schema=public"
AUTH_SECRET="replace-me"
AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="64-char-hex-string"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
REDIS_URL="redis://localhost:6379"
```

如果要启用 GitHub 登录，再补充：

```env
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
```

### 4. 生成 Prisma Client 并同步数据库

```bash
pnpm db:generate
npx prisma db push
```

### 5. 启动项目

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

未登录时会自动跳转到 `/login`，登录后首页会重定向到工作台主界面。

---

## 项目结构

```text
src/
├── app/
│   ├── (auth)/                  # 登录 / 注册页面
│   ├── (dashboard)/             # 登录后的主产品界面
│   │   ├── chat/                # 流式聊天
│   │   ├── customers/           # 智能工作台：Agent、知识库、任务
│   │   ├── dashboard/           # 用量分析与图表
│   │   ├── image-generation/    # 图像生成与任务监控
│   │   └── settings/            # API Key 与设置
│   └── api/                     # 服务端接口
├── components/
│   ├── chat/                    # 聊天面板、消息流、选择器、记忆抽屉
│   ├── customers/               # 智能工作台 UI 组件
│   ├── dashboard/               # 统计卡片与图表
│   └── layout/                  # 侧边栏、主题、应用壳
├── lib/
│   ├── agent/                   # ReAct Runtime 与编排逻辑
│   ├── llm/                     # 模型注册表与 Provider 适配
│   ├── memory/                  # Embedding、检索、RAG
│   ├── tools/                   # 内置工具注册与定义
│   └── images/                  # 图像任务执行与序列化
├── server/db/                   # Prisma Client 与数据库辅助
└── stores/                      # 前端状态

prisma/
└── schema.prisma                # 核心数据模型
```

---

## README 说明

仓库里仍然有少量更早阶段遗留下来的命名和注释，例如部分 CRM 风格的术语还没有完全清理掉。这个 README 已经尽量按照**当前真实功能形态**来描述项目，而不是沿用最初脚手架时期的说法。

---

## 开发路线

### 近期

- 把 `projects / agents / knowledge / tasks` 的信息架构继续统一
- 扩展 Provider 管理和自定义模型配置体验
- 完善后台任务执行与状态流更新
- 强化 RAG 导入链路，对更多文档格式和失败恢复做优化

### 中期

- 更清晰的多项目隔离和项目切换
- 更强的 HTTP / MCP 类工具扩展能力
- 更完整的 Agent 调试、追踪和回放视图
- 更成熟的 Tauri 桌面端工作流

### 长期

- 面向生产的多 Agent 编排
- 更丰富的自动化工作流
- 更完整的团队 / 组织协作能力

---

## Star History

<p align="center">
  <a href="https://www.star-history.com/#li3500764/opencat&Date">
    <img
      alt="Star History Chart"
      src="https://api.star-history.com/svg?repos=li3500764/opencat&type=Date"
    />
  </a>
</p>

---

## 开源协议

[MIT](./LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/li3500764">@li3500764</a>
</p>
