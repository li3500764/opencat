<p align="center">
  <img src="https://img.icons8.com/emoji/96/cat-emoji.png" width="80" />
</p>

<h1 align="center">OpenCat</h1>

<p align="center">
  <strong>Open-source AI Agent Orchestration Platform</strong>
</p>

<p align="center">
  Multi-model LLM Gateway &nbsp;·&nbsp; ReAct Agent Engine &nbsp;·&nbsp; RAG Pipeline &nbsp;·&nbsp; Desktop Client
</p>

<p align="center">
  <a href="#features">Features</a> &nbsp;&bull;&nbsp;
  <a href="#tech-stack">Tech Stack</a> &nbsp;&bull;&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;&bull;&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;&bull;&nbsp;
  <a href="#roadmap">Roadmap</a> &nbsp;&bull;&nbsp;
  <a href="./README_CN.md">中文文档</a>
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

<p align="center">
  <a href="https://github.com/li3500764/opencat/stargazers">GitHub Stars</a> &nbsp;&bull;&nbsp;
  <a href="https://github.com/li3500764/opencat/network/members">Forks</a> &nbsp;&bull;&nbsp;
  <a href="https://github.com/li3500764/opencat/issues">Issues</a>
</p>

---

## What is OpenCat?

OpenCat is a **self-hosted AI agent platform** that gives you full control over your LLM workflows. Instead of relying on closed-source tools, you get a production-grade system with multi-model routing, autonomous agents, knowledge retrieval, and a clean desktop experience — all running on your own infrastructure.

> **No LangChain. No magic wrappers.** Every agent loop, tool call, and retrieval pipeline is implemented from scratch for full transparency and zero vendor lock-in.

---

## Features

### Shipped

- **SSE Streaming Chat** — Real-time token streaming via Server-Sent Events
- **Authentication** — NextAuth v5 with GitHub OAuth + email/password credentials
- **Conversation Persistence** — Full message history stored in PostgreSQL
- **Encrypted API Key Storage** — AES-256-GCM encryption for all stored secrets
- **Theme System** — Warm gray + amber design with light/dark mode
- **Zustand State** — Client-side conversation management with optimistic updates

### In Progress

- **Multi-Model Gateway** — Route between OpenAI, Anthropic, and custom providers
- **ReAct Agent Engine** — Autonomous reasoning + action loops with tool calling
- **Multi-Agent Orchestration** — Orchestrator pattern for complex workflows
- **Memory System** — Auto-summarization with pgvector similarity search
- **RAG Pipeline** — Document upload → chunking → embedding → retrieval
- **Token Dashboard** — Usage analytics and cost tracking
- **Tauri 2.0 Desktop** — Native cross-platform client

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | TailwindCSS 4 + Geist Font |
| **Database** | PostgreSQL 17 + pgvector |
| **ORM** | Prisma 7 with `@prisma/adapter-pg` |
| **Cache** | Redis 7 |
| **Auth** | NextAuth v5 (JWT sessions) |
| **AI** | Vercel AI SDK 6.x |
| **State** | Zustand 5 |
| **Validation** | Zod 4 |
| **Desktop** | Tauri 2.0 _(planned)_ |
| **Package Manager** | pnpm 10 |

---

## Getting Started

### Prerequisites

- **Node.js** 22 LTS
- **pnpm** 10+
- **Docker** (for PostgreSQL + Redis)

### 1. Clone & Install

```bash
git clone https://github.com/li3500764/opencat.git
cd opencat
pnpm install
```

### 2. Start Services

```bash
docker compose up -d
```

This spins up:
- **PostgreSQL 17** (pgvector) on port `5433`
- **Redis 7** on port `6379`

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://opencat:opencat@localhost:5433/opencat?schema=public"
AUTH_SECRET="your-auth-secret"          # openssl rand -base64 32
ENCRYPTION_KEY="your-encryption-key"    # openssl rand -hex 32
OPENAI_API_KEY="sk-..."
```

### 4. Initialize Database

```bash
npx prisma db push
```

### 5. Run

```bash
pnpm dev
```

Open **http://localhost:3001** and create an account to start chatting.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client (React 19)               │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Chat UI  │  │ Sidebar  │  │ Theme Provider │  │
│  │ useChat()│  │ Zustand  │  │ Light / Dark   │  │
│  └────┬─────┘  └──────────┘  └────────────────┘  │
│       │ SSE Stream                                │
├───────┼──────────────────────────────────────────┤
│       ▼          Server (Next.js App Router)      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Chat API│  │ Auth API │  │ Conversations   │  │
│  │ stream  │  │ NextAuth │  │ API             │  │
│  │ Text()  │  │ v5 + JWT │  │ CRUD            │  │
│  └────┬────┘  └──────────┘  └────────┬────────┘  │
│       │                              │            │
│  ┌────▼──────────────────────────────▼─────────┐  │
│  │          Prisma 7 + pg Pool Adapter          │  │
│  └──────────────────┬──────────────────────────┘  │
├─────────────────────┼────────────────────────────┤
│                     ▼         Infrastructure      │
│  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  PostgreSQL 17       │  │  Redis 7          │  │
│  │  + pgvector          │  │  Cache / Queue    │  │
│  │  15 tables           │  │                   │  │
│  └──────────────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Database Schema (15 tables)

```
User ──┬── Account (OAuth)
       ├── Session
       ├── ApiKey (AES-256-GCM encrypted)
       ├── Project ──┬── Agent (systemPrompt, tools[], model)
       │             ├── Conversation ── Message (role, parts, tokenCount)
       │             └── KnowledgeBase ── Document ── DocumentChunk (embedding)
       ├── Memory (pgvector 1536d)
       └── UsageLog (token tracking)
```

### Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login / Register pages
│   ├── (dashboard)/     # Protected chat interface
│   └── api/
│       ├── auth/        # NextAuth + registration
│       ├── chat/        # SSE streaming endpoint
│       └── conversations/  # CRUD operations
├── components/
│   ├── chat/            # ChatPanel, MessageList, ChatInput, Markdown
│   └── layout/          # Sidebar, ThemeProvider, ThemeToggle
├── lib/                 # auth.ts, crypto.ts, utils.ts
├── server/db/           # Prisma client singleton
├── stores/              # Zustand (chat, theme)
└── types/               # NextAuth type augmentation
```

---

## Roadmap

| Phase | Milestone | Status |
|:-----:|:----------|:------:|
| 1 | Scaffolding + Auth + Database Schema | ✅ |
| 2 | Single Model Chat + SSE Streaming | ✅ |
| 3 | Multi-Model Gateway + API Key Management | ⏳ |
| 4 | Tool Calling + ReAct Agent Engine | ⏳ |
| 5 | Multi-Agent Orchestration + Project Isolation | ⏳ |
| 6 | Memory System + RAG with pgvector | ⏳ |
| 7 | Usage Dashboard + Tauri 2.0 Desktop Client | ⏳ |

---

## Design Philosophy

- **No LangChain** — Self-implemented agent runtime for full control and zero abstraction overhead
- **No AI-gradient UI** — Clean warm-gray + amber palette inspired by Linear and Raycast
- **Security first** — AES-256-GCM encrypted key storage, JWT sessions, bcrypt password hashing
- **Production patterns** — Connection pooling, singleton clients, streaming responses, usage tracking

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

This chart is rendered directly in the repository `README`, so when someone scrolls down on the GitHub project page they can see how the repo's star growth changes over time.

---

## License

[MIT](./LICENSE)

---

<p align="center">
  Built with obsession by <a href="https://github.com/li3500764">@li3500764</a>
</p>
