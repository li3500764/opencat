---
kind: logging_system
name: 多语言日志体系：Go 结构化 slog + Next.js console 散点输出
category: logging_system
scope:
    - '**'
source_files:
    - worker/cmd/worker/main.go
    - worker/internal/dispatcher/dispatcher.go
    - worker/internal/reporter/reporter.go
    - src/app/api/chat/route.ts
    - src/app/api/customers/[id]/route.ts
---

本仓库采用“双栈各自为政”的日志策略，没有统一的跨进程/跨语言日志框架或集中式日志采集器。

### Go Worker（后台任务服务）
- 使用标准库 `log/slog`，在 `worker/cmd/worker/main.go` 启动时通过 `slog.NewJSONHandler(os.Stdout, nil)` 将默认 logger 设置为 JSON 格式并输出到 stdout，便于容器编排与外部日志收集系统抓取。
- 全 Worker 代码统一通过全局 `slog.Info/Warn/Error` 调用，并以键值对形式附带上下文字段（如 `taskId`、`type`、`msgId`、`err`、`host`、`signal` 等），属于典型的结构化日志风格。
- 日志级别覆盖 Info / Warn / Error，用于记录启动流程、数据库/Redis 连接、任务分发、执行结果、优雅关停等关键路径；panic 被 recover 捕获后以 `slog.Error` 上报并通过 Reporter 持久化错误信息。
- 任务进度/状态变更不依赖 slog，而是通过 `reporter.ReportProgress/ReportComplete/ReportFailed` 写入 PostgreSQL 并通过 Redis Pub/Sub 广播给 Next.js 前端 SSE 推送，形成“运行期日志落库 + 实时流式上报”的双通道。

### Next.js 应用（API Route 层）
- 未引入任何 Node.js 日志框架（无 pino/winston/bunyan/debug 等），所有 API Route 直接调用 `console.log/console.warn/console.error` 输出。
- 日志内容多为带前缀的字符串拼接（如 `[Chat API] Database error:`、`[POST /api/customers/[id]/analyze] 诊断分析接口失败: ...`），部分调用附带对象参数以便打印堆栈，但整体缺乏统一字段规范与结构化输出。
- 脚本目录（`scripts/`、`prisma/seed-cri.ts`）同样使用裸 `console.log/error` 做一次性工具输出。

### 架构约定与缺失
- 不存在共享的 `src/lib/logger.ts` 或 `lib/logging/` 模块，也没有环境变量控制日志级别、采样率或输出目标。
- Go 侧 JSON 结构化日志与 Next.js 侧非结构化 console 输出之间没有桥接，无法在同一平台（如 Loki/ELK）中按统一 schema 检索。
- 任务执行期的“用户可见日志”走的是业务 Reporter 通道（DB + Redis → SSE），而非 slog/console，因此生产排查需同时关注 stdout 日志与数据库 `background_tasks` 表中的 log 字段。

### 开发者应遵循的规则
- **Go 侧**：继续使用 `slog.Info/Warn/Error` 并附带关键业务键（taskId、userId、type、err 等），保持 JSON 输出，避免混入 fmt.Printf。
- **Next.js 侧**：建议抽取一个轻量 logger 封装（例如基于 pino 或仅对 console 加统一前缀/字段），使 API Route 日志具备可过滤的结构化字段，与 Go worker 的 slog 字段命名保持一致（如 taskId、userId、type）。
- **任务日志**：长任务的用户可读日志应通过 `reporter.ReportProgress(...)` 上报，不要仅依赖 slog/console，否则前端无法实时看到进度。
- **敏感信息**：当前未见脱敏逻辑，应避免在 slog/console 中输出密钥、密码、完整请求体等敏感数据。