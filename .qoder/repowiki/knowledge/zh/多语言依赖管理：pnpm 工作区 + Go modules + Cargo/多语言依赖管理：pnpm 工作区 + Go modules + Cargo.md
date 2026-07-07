---
kind: dependency_management
name: 多语言依赖管理：pnpm 工作区 + Go modules + Cargo
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - pnpm-workspace.yaml
    - .pnpmrc.json
    - pnpm-lock.yaml
    - worker/go.mod
    - worker/go.sum
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
---

## 1. 使用的系统与方法
- **Node.js 生态**：使用 pnpm 作为包管理器，通过 `pnpm-workspace.yaml` 启用工作区模式；依赖声明集中在根目录的 `package.json`。构建产物锁定在 `pnpm-lock.yaml`。
- **Go Worker 服务**：位于 `worker/` 子模块，采用标准 Go modules（`go.mod` + `go.sum`）管理第三方库，仅引入 pgx v5 与 go-redis v9 两个核心依赖。
- **Tauri 桌面壳**：位于 `src-tauri/`，使用 Rust/Cargo 管理依赖（`Cargo.toml` + `Cargo.lock`），依赖面很小（tauri、serde 等）。
- **原生依赖白名单**：通过 `.pnpmrc.json` 与 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 字段限制需要编译的原生包，避免无关 native 依赖被安装。

## 2. 关键文件与位置
- `package.json` — Next.js 应用与 Tauri CLI 的 Node 依赖、脚本入口、`postinstall` 触发 Prisma generate。
- `pnpm-workspace.yaml` / `.pnpmrc.json` — pnpm 全局配置与工作区行为，限定 onlyBuiltDependencies。
- `pnpm-lock.yaml` — 全仓库锁定的 Node 依赖树快照。
- `worker/go.mod` / `worker/go.sum` — Go Worker 服务的依赖清单与版本锁定。
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` — Tauri/Rust 侧依赖与锁定。
- `Dockerfile` / `docker-compose.yml` — 容器化时复用上述 lock 文件保证可重复构建。

## 3. 架构与约定
- **单仓库多语言**：Next.js 前端、Go Worker、Tauri 壳在同一仓库中各自维护独立的依赖清单，互不共享 node_modules，由 pnpm workspace 统一解析。
- **只声明必要依赖**：Go 与 Rust 侧依赖数量极少，保持最小化；Node 侧将 AI SDK（@ai-sdk/*）、Auth、Prisma、Redis、Zod 等按功能分组集中声明。
- **构建期依赖隔离**：`pnpm` 的 `onlyBuiltDependencies` 显式允许 `@prisma/engines`、`prisma`、`sharp`、`unrs-resolver` 等带 C++ 扩展的包参与构建，其余 native 包一律跳过，减小镜像体积与安装时间。
- **数据库与缓存作为外部依赖**：Postgres 与 Redis 通过 docker-compose 提供，代码层通过 `pg` + `ioredis` 客户端连接，不在 package.json 中声明为运行时依赖。

## 4. 开发者应遵循的规则
- **新增 Node 依赖**：在根 `package.json` 的 `dependencies`/`devDependencies` 中声明，并运行 `pnpm install` 更新 `pnpm-lock.yaml`；若引入新的原生包，需同步更新 `.pnpmrc.json` 与 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 白名单。
- **Go 依赖变更**：在 `worker/` 下执行 `go mod tidy`，确保 `go.mod` 与 `go.sum` 一致后再提交。
- **Rust/Tauri 依赖变更**：在 `src-tauri/` 下修改 `Cargo.toml` 后执行 `cargo update`，提交 `Cargo.lock`。
- **禁止手动编辑 lock 文件**：所有版本锁定应由对应包管理器生成，避免跨平台不一致。
- **容器构建一致性**：Dockerfile 应基于已锁定的 lock 文件安装依赖，不要在生产镜像中执行 `pnpm install --no-frozen-lockfile` 之类的宽松策略。