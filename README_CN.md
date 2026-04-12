<p align="center">
  <img src="https://img.icons8.com/emoji/96/cat-emoji.png" width="80" />
</p>

<h1 align="center">OpenCat</h1>

<p align="center">
  <strong>开源 AI Agent 编排平台</strong>
</p>

<p align="center">
  多模型 LLM 网关 &nbsp;·&nbsp; ReAct Agent 引擎 &nbsp;·&nbsp; RAG 知识库 &nbsp;·&nbsp; 桌面客户端
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> &nbsp;&bull;&nbsp;
  <a href="#技术栈">技术栈</a> &nbsp;&bull;&nbsp;
  <a href="#快速开始">快速开始</a> &nbsp;&bull;&nbsp;
  <a href="#系统架构">系统架构</a> &nbsp;&bull;&nbsp;
  <a href="#开发路线">开发路线</a> &nbsp;&bull;&nbsp;
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/AI_SDK-6.x-000?logo=vercel" />
  <img src="https://img.shields.io/badge/Tauri-2.0-ffc131?logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 这是什么？

OpenCat 是一个**可自托管的 AI Agent 平台**，让你完全掌控自己的 LLM 工作流。无需依赖闭源工具，你将获得一套生产级系统 — 多模型路由、自主 Agent、知识检索、桌面客户端 — 全部运行在你自己的基础设施上。

> **不用 LangChain，不用魔法封装。** 每个 Agent 循环、工具调用、检索管线都从零实现，完全透明，零供应商锁定。

---

## 功能特性

### 已完成

- **SSE 流式对话** — 基于 Server-Sent Events 的实时 Token 流
- **认证系统** — NextAuth v5，支持 GitHub OAuth + 邮箱密码登录
- **对话持久化** — 完整消息历史存储在 PostgreSQL
- **密钥加密存储** — AES-256-GCM 加密所有存储的 API Key
- **主题系统** — 暖灰 + 琥珀色设计，支持亮色/暗色模式
- **Zustand 状态管理** — 客户端对话管理 + 乐观更新

### 开发中

- **多模型网关** — 在 OpenAI、Anthropic 和自定义 Provider 之间灵活路由
- **ReAct Agent 引擎** — 自主推理 + 行动循环，支持工具调用
- **多 Agent 编排** — Orchestrator 模式处理复杂工作流
- **记忆系统** — 自动摘要 + pgvector 相似度检索
- **RAG 知识库** — 文档上传 → 分块 → 向量化 → 检索全链路
- **Token 仪表盘** — 用量分析与成本追踪
- **Tauri 2.0 桌面端** — 原生跨平台客户端

---

## 技术栈

| 层级 | 技术选型 |
|:-----|:---------|
| **框架** | Next.js 16 (App Router) + React 19 |
| **语言** | TypeScript 5 (严格模式) |
| **样式** | TailwindCSS 4 + Geist 字体 |
| **数据库** | PostgreSQL 17 + pgvector 向量扩展 |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` |
| **缓存** | Redis 7 |
| **认证** | NextAuth v5 (JWT 会话) |
| **AI** | Vercel AI SDK 6.x |
| **状态管理** | Zustand 5 |
| **校验** | Zod 4 |
| **桌面端** | Tauri 2.0 _(计划中)_ |
| **包管理** | pnpm 10 |

---

## 快速开始

### 前置要求

- **Node.js** 22 LTS
- **pnpm** 10+
- **Docker**（用于 PostgreSQL + Redis）

### 1. 克隆 & 安装

```bash
git clone https://github.com/li3500764/opencat.git
cd opencat
pnpm install
```

### 2. 启动基础服务

```bash
docker compose up -d
```

将启动：
- **PostgreSQL 17**（含 pgvector）— 端口 `5433`
- **Redis 7** — 端口 `6379`

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
DATABASE_URL="postgresql://opencat:opencat@localhost:5433/opencat?schema=public"
AUTH_SECRET="你的密钥"                    # openssl rand -base64 32
ENCRYPTION_KEY="你的加密密钥"              # openssl rand -hex 32
OPENAI_API_KEY="sk-..."
```

### 4. 初始化数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
pnpm dev
```

打开 **http://localhost:3001**，注册账号即可开始对话。

---

## 系统架构

```
┌──────────────────────────────────────────────────┐
│                客户端 (React 19)                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ 对话界面  │  │  侧边栏   │  │   主题切换     │  │
│  │ useChat()│  │ Zustand  │  │  亮色 / 暗色   │  │
│  └────┬─────┘  └──────────┘  └────────────────┘  │
│       │ SSE 流                                    │
├───────┼──────────────────────────────────────────┤
│       ▼        服务端 (Next.js App Router)         │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Chat API│  │ Auth API │  │  对话管理 API    │  │
│  │ stream  │  │ NextAuth │  │  CRUD           │  │
│  │ Text()  │  │ v5 + JWT │  │                 │  │
│  └────┬────┘  └──────────┘  └────────┬────────┘  │
│       │                              │            │
│  ┌────▼──────────────────────────────▼─────────┐  │
│  │         Prisma 7 + pg 连接池适配器            │  │
│  └──────────────────┬──────────────────────────┘  │
├─────────────────────┼────────────────────────────┤
│                     ▼           基础设施           │
│  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  PostgreSQL 17       │  │  Redis 7          │  │
│  │  + pgvector 向量检索  │  │  缓存 / 队列      │  │
│  │  15 张数据表          │  │                   │  │
│  └──────────────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 数据库模型（15 张表）

```
User ──┬── Account (OAuth 账号)
       ├── Session (会话)
       ├── ApiKey (AES-256-GCM 加密存储)
       ├── Project ──┬── Agent (系统提示词, 工具集, 模型配置)
       │             ├── Conversation ── Message (角色, 内容, Token 计数)
       │             └── KnowledgeBase ── Document ── DocumentChunk (向量嵌入)
       ├── Memory (pgvector 1536 维向量)
       └── UsageLog (用量追踪)
```

### 项目结构

```
src/
├── app/
│   ├── (auth)/          # 登录 / 注册页面
│   ├── (dashboard)/     # 受保护的对话界面
│   └── api/
│       ├── auth/        # NextAuth + 注册接口
│       ├── chat/        # SSE 流式对话端点
│       └── conversations/  # 对话 CRUD
├── components/
│   ├── chat/            # ChatPanel, MessageList, ChatInput, Markdown
│   └── layout/          # Sidebar, ThemeProvider, ThemeToggle
├── lib/                 # auth.ts, crypto.ts, utils.ts
├── server/db/           # Prisma 客户端单例
├── stores/              # Zustand (chat, theme)
└── types/               # NextAuth 类型扩展
```

---

## 开发路线

| 阶段 | 里程碑 | 状态 |
|:----:|:-------|:----:|
| 1 | 脚手架 + 认证系统 + 数据库设计 | ✅ |
| 2 | 单模型对话 + SSE 流式输出 | ✅ |
| 3 | 多模型网关 + API Key 管理 | ⏳ |
| 4 | 工具调用 + ReAct Agent 引擎 | ⏳ |
| 5 | 多 Agent 编排 + 项目隔离 | ⏳ |
| 6 | 记忆系统 + RAG 向量检索 | ⏳ |
| 7 | 用量仪表盘 + Tauri 2.0 桌面端 | ⏳ |

---

## 设计理念

- **不用 LangChain** — 自研 Agent 运行时，完全掌控，零抽象开销
- **拒绝 AI 渐变风** — 干净的暖灰 + 琥珀色调，灵感来自 Linear 和 Raycast
- **安全优先** — AES-256-GCM 密钥加密、JWT 会话、bcrypt 密码哈希
- **生产级模式** — 连接池、单例客户端、流式响应、用量追踪

---

## 开源协议

[MIT](./LICENSE)

---

<p align="center">
  Built with obsession by <a href="https://github.com/li3500764">@li3500764</a>
</p>
