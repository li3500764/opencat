<p align="center">
  <img src="./public/logo.png" width="120" alt="OpenCat logo" />
</p>

<h1 align="center">OpenCat</h1>

<p align="center">
  <strong>An open-source AI workspace for agents, knowledge, tools, and long-running tasks</strong>
</p>

<p align="center">
  Multi-model chat &nbsp;·&nbsp; ReAct agents &nbsp;·&nbsp; Memory + RAG &nbsp;·&nbsp; Image generation &nbsp;·&nbsp; Usage analytics
</p>

<p align="center">
  <a href="#highlights">Highlights</a> &nbsp;&bull;&nbsp;
  <a href="#current-capabilities">Current Capabilities</a> &nbsp;&bull;&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;&bull;&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;&bull;&nbsp;
  <a href="#project-structure">Project Structure</a> &nbsp;&bull;&nbsp;
  <a href="#roadmap">Roadmap</a> &nbsp;&bull;&nbsp;
  <a href="./README_CN.md">中文文档</a>
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

## What Is OpenCat?

OpenCat is a **self-hosted AI workspace** for building practical agent workflows on your own infrastructure.

It is no longer just a streaming chat demo. The current project combines:

- **multi-model chat** driven by user-managed API keys
- **ReAct-style agents** with tool calling and orchestrator support
- **memory and RAG** backed by PostgreSQL + pgvector
- **image generation tasks** with async progress tracking
- **usage analytics** for tokens, cost, model distribution, and activity logs
- **a smart workspace UI** for managing agents, knowledge bases, and background tasks

The goal is to give you a transparent, hackable alternative to closed AI workspaces without hiding the core runtime behind heavy abstractions.

> **No magic wrappers.** The agent loop, tool system, memory retrieval, and document pipeline are implemented in the app itself so you can inspect and extend the whole stack.

---

## Highlights

- **Streaming chat with real persistence** via SSE, PostgreSQL, and conversation history
- **User-managed model registry** where available models come from the API keys each user configures
- **Agent orchestration** with per-agent prompts, model selection, tool lists, and sub-agent delegation
- **Memory injection** that retrieves relevant user/project memories before the model answers
- **RAG knowledge bases** with document chunking, embeddings, pgvector search, and prompt augmentation
- **Built-in tool system** for calculators, datetime, HTTP requests, memory ops, documents, finance, and agent-to-agent calls
- **Async task workflows** for image generation and knowledge processing with progress and logs
- **Operational analytics** including token quota, cost trends, model usage distribution, and recent API activity
- **Bilingual UI foundations** with `en` and `zh` translations already in the codebase

---

## Current Capabilities

### Workspace

- Login and registration with **NextAuth v5**
- GitHub OAuth plus email/password auth
- A default project is created automatically for new chat flows
- Dashboard layout with chat, smart workspace, image generation, settings, and analytics views

### Chat And Agents

- SSE-based streaming chat
- Conversation persistence in PostgreSQL
- Per-agent model, prompt, temperature, tool list, and max step configuration
- Orchestrator agents that can call sub-agents through a dedicated `call_agent` tool
- Tool-aware agent runtime built on the Vercel AI SDK

### Memory And Knowledge

- Long-term memory records with category and importance metadata
- Memory retrieval injected into the system prompt before response generation
- Knowledge base management and document ingestion
- Text chunking, embeddings, and pgvector similarity search
- Fallback behavior when embeddings are unavailable

### Tools

Built-in tools currently exported in the codebase include:

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

### Image Generation

- Dedicated image generation page
- Text-to-image and image-to-image modes
- Async task polling with task status, progress, logs, and result previews
- Model selection based on the API keys configured by the user

### Analytics

- Token quota and usage tracking
- Total API cost aggregation
- 14-day trend charts for tokens, cost, and message volume
- Model usage distribution
- Recent usage ledger for prompt, completion, total tokens, and cost

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Framework** | Next.js 16 + React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Auth** | NextAuth v5 |
| **AI Runtime** | Vercel AI SDK 6.x |
| **Database** | PostgreSQL 17 |
| **Vector Search** | pgvector |
| **ORM** | Prisma 7 |
| **Cache / Queue Support** | Redis 7 |
| **Desktop** | Tauri 2 |
| **State** | Zustand |
| **Validation** | Zod 4 |
| **Package Manager** | pnpm 10 |

---

## Architecture

```text
Browser / Desktop UI
  -> Next.js App Router pages
  -> Chat, Smart Workspace, Image Generation, Settings, Dashboard

Application Layer
  -> API routes for chat, agents, tools, knowledge, memory, keys, stats, tasks
  -> NextAuth authentication and user isolation

AI Runtime
  -> model registry from user API keys
  -> ReAct-style agent stream
  -> built-in tools + dynamic call_agent orchestration
  -> memory retrieval + RAG chunk injection

Data Layer
  -> PostgreSQL for users, projects, agents, conversations, logs, knowledge, tasks
  -> pgvector for semantic retrieval
  -> Redis for caching / future queue-oriented workflows
```

### Core Data Domains

The Prisma schema now covers more than the original chat demo. Key domains include:

- `User`, `Account`, `Session`
- `ApiKey`
- `Project`
- `Agent`
- `Conversation`, `Message`
- `Tool`
- `Memory`
- `KnowledgeBase`, `Document`, `DocumentChunk`
- `BackgroundTask`
- `UsageLog`
- `Organization`, `Lead`, `CustomerInteraction`, and related business entities already present in the app

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker

### 1. Install dependencies

```bash
git clone https://github.com/li3500764/opencat.git
cd opencat
pnpm install
```

### 2. Start local services

```bash
docker compose up -d
```

This starts:

- PostgreSQL 17 with pgvector on `localhost:5433`
- Redis 7 on `localhost:6379`

### 3. Configure environment variables

```bash
cp .env.example .env
```

At minimum, set:

```env
DATABASE_URL="postgresql://opencat:opencat@localhost:5433/opencat?schema=public"
AUTH_SECRET="replace-me"
AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="64-char-hex-string"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
REDIS_URL="redis://localhost:6379"
```

Optional for GitHub login:

```env
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
```

### 4. Generate Prisma client and sync the database

```bash
pnpm db:generate
npx prisma db push
```

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If you are not logged in, the app redirects to `/login`. After login, the home route redirects to the workspace dashboard.

---

## Project Structure

```text
src/
├── app/
│   ├── (auth)/                  # Login and registration pages
│   ├── (dashboard)/             # Main authenticated product surface
│   │   ├── chat/                # Streaming chat UI
│   │   ├── customers/           # Smart workspace: agents, knowledge, tasks
│   │   ├── dashboard/           # Usage analytics and charts
│   │   ├── image-generation/    # Image task creation and monitoring
│   │   └── settings/            # API key and workspace settings
│   └── api/                     # Server endpoints
├── components/
│   ├── chat/                    # Chat panel, message list, selectors, memory drawer
│   ├── customers/               # Smart workspace UI pieces
│   ├── dashboard/               # Stat cards and charts
│   └── layout/                  # Sidebar, theme, app shell
├── lib/
│   ├── agent/                   # ReAct runtime and orchestration
│   ├── llm/                     # Model registry and provider helpers
│   ├── memory/                  # Embeddings, retrieval, RAG
│   ├── tools/                   # Built-in tool registry and definitions
│   └── images/                  # Image task runner and serialization
├── server/db/                   # Prisma client and database helpers
└── stores/                      # Client state

prisma/
└── schema.prisma                # Application data model
```

---

## README Notes

Some older parts of the codebase still carry comments or naming from earlier phases, including CRM-oriented terminology in a few routes and screens. This README reflects the **current functional shape of the project**, not just the earliest scaffolding language.

---

## Roadmap

### Near Term

- Polish the workspace IA so `projects`, `agents`, `knowledge`, and `tasks` feel more unified
- Expand provider management and custom model configuration
- Improve background task execution and streaming status updates
- Harden RAG ingestion for more document formats and better recovery paths

### Mid Term

- Better multi-project isolation and project switching
- Richer tool authoring for HTTP and MCP-style integrations
- More explicit agent debugging, traces, and replay views
- Stronger desktop workflows with Tauri packaging

### Long Term

- Production-ready multi-agent orchestration
- Broader automation workflows
- More complete team / organization collaboration features

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

## License

[MIT](./LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/li3500764">@li3500764</a>
</p>
