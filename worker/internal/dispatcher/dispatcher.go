package dispatcher

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"opencat-worker/internal/db"
	"opencat-worker/internal/executor"
	"opencat-worker/internal/queue"
	"opencat-worker/internal/reporter"
)

// Dispatcher 负责从 Redis Stream 消费任务，并分发给对应的执行器运行
type Dispatcher struct {
	db          *db.DB
	queue       *queue.RedisQueue
	reporter    reporter.Reporter
	executors   map[string]executor.Executor
	concurrency int
	sem         chan struct{} // 用于控制并发数的信号量 channel
	wg          sync.WaitGroup
	hostname    string
}

// NewDispatcher 创建一个新的任务分发器
func NewDispatcher(database *db.DB, redisQueue *queue.RedisQueue, maxConcurrency int) *Dispatcher {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-worker-host"
	}
	downloadsDir := os.Getenv("DOWNLOADS_DIR")
	if downloadsDir == "" {
		downloadsDir = "./public/downloads"
	}

	rep := reporter.NewDefaultReporter(database, redisQueue)

	d := &Dispatcher{
		db:          database,
		queue:       redisQueue,
		reporter:    rep,
		executors:   make(map[string]executor.Executor),
		concurrency: maxConcurrency,
		sem:         make(chan struct{}, maxConcurrency),
		hostname:    hostname,
	}

	// 注册默认的执行器
	d.RegisterExecutor("rag-ingest", executor.NewRagIngestExecutor(database))
	d.RegisterExecutor("image-generation", executor.NewImageGenerationExecutor(database, downloadsDir))

	return d
}

// RegisterExecutor 注册特定类型的任务执行器
func (d *Dispatcher) RegisterExecutor(taskType string, exec executor.Executor) {
	d.executors[taskType] = exec
}

// Start 启动分发器监听循环（阻塞直到 ctx 取消）
func (d *Dispatcher) Start(ctx context.Context) error {
	slog.Info("正在初始化 Redis 消费者组...")
	if err := d.queue.CreateConsumerGroupIfNotExist(ctx); err != nil {
		return fmt.Errorf("创建消费者组失败: %w", err)
	}

	slog.Info("Go Worker 任务分发器已启动，开始监听任务队列", "concurrency", d.concurrency, "host", d.hostname)

	for {
		select {
		case <-ctx.Done():
			slog.Info("分发器收到退出信号，停止拉取新任务。")
			d.wg.Wait()
			return nil
		default:
			// 1. 尝试获取信号量（控制并发）
			select {
			case d.sem <- struct{}{}:
				// 成功获取并发插槽，可以读取任务
			case <-ctx.Done():
				return nil
			}

			// 2. 读取新任务
			msg, err := d.queue.ReadTask(ctx, d.hostname)
			if err != nil {
				slog.Error("从队列读取任务失败", "err", err)
				<-d.sem // 释放并发插槽
				time.Sleep(2 * time.Second)
				continue
			}

			if msg == nil {
				// 没有新任务时，尝试接管部署重启或旧消费者崩溃后遗留的 pending 消息。
				claimedMsg, claimErr := d.queue.ClaimStaleTask(ctx, d.hostname, 2*time.Minute)
				if claimErr != nil {
					slog.Error("接管超时 pending 任务失败", "err", claimErr)
					<-d.sem
					time.Sleep(2 * time.Second)
					continue
				}
				if claimedMsg == nil {
					<-d.sem
					time.Sleep(200 * time.Millisecond)
					continue
				}
				msg = claimedMsg
				slog.Info("已接管超时 pending 后台任务", "msgId", msg.ID, "taskId", msg.Fields["taskId"])
			}

			// 3. 读到任务，启动 goroutine 异步处理
			d.wg.Add(1)
			go func(tMsg *queue.TaskMessage) {
				defer func() {
					<-d.sem // 任务结束，释放并发插槽
					d.wg.Done()
				}()

				// 异常恢复机制，防止执行器内部 panic 导致整个 Worker 挂掉
				defer func() {
					if r := recover(); r != nil {
						slog.Error("任务执行发生严重恐慌 (panic) 被成功拦截", "panic", r, "msgId", tMsg.ID)
						taskId := tMsg.Fields["taskId"]
						userId := tMsg.Fields["userId"]
						if taskId != "" {
							_ = d.reporter.ReportFailed(context.Background(), taskId, userId, fmt.Sprintf("服务器发生内部恐慌错误: %v", r))
						}
					}
				}()

				d.processTaskMessage(ctx, tMsg)
			}(msg)
		}
	}
}

// processTaskMessage 处理单条 Stream 任务消息
func (d *Dispatcher) processTaskMessage(ctx context.Context, msg *queue.TaskMessage) {
	taskId := msg.Fields["taskId"]
	taskType := msg.Fields["type"]
	userId := msg.Fields["userId"]

	slog.Info("开始处理后台长任务", "taskId", taskId, "type", taskType, "msgId", msg.ID)

	if taskId == "" || taskType == "" {
		slog.Error("任务消息中缺失 taskId 或 type 字段，丢弃该消息", "msgId", msg.ID)
		_ = d.queue.AckTask(ctx, msg.ID)
		return
	}

	// 1. 匹配对应的执行器
	exec, exists := d.executors[taskType]
	if !exists {
		slog.Error("未找到对应任务类型的执行器", "type", taskType, "taskId", taskId)
		_ = d.reporter.ReportFailed(ctx, taskId, userId, fmt.Sprintf("未注册任务类型 [%s] 的执行器", taskType))
		_ = d.queue.AckTask(ctx, msg.ID)
		return
	}

	// 2. 从数据库读取任务状态
	task, err := d.db.GetTask(ctx, taskId)
	if err != nil {
		slog.Error("从数据库读取任务记录失败", "taskId", taskId, "err", err)
		_ = d.queue.AckTask(ctx, msg.ID)
		return
	}
	if task.Status == "completed" || task.Status == "failed" {
		slog.Info("后台任务已经结束，确认并跳过队列消息", "taskId", taskId, "status", task.Status, "msgId", msg.ID)
		_ = d.queue.AckTask(ctx, msg.ID)
		return
	}

	// 3. 执行任务（带超时控制，防止无限挂起）
	// 我们给单个任务分配 30 分钟默认超时
	taskCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	err = exec.Execute(taskCtx, task, d.reporter)

	// 4. 结果处理
	if err != nil {
		slog.Error("任务执行失败", "taskId", taskId, "err", err)
		_ = d.reporter.ReportFailed(ctx, taskId, userId, err.Error())
	} else {
		slog.Info("任务执行成功并已归档", "taskId", taskId)
	}

	// 5. 确认消息已经被消费完毕
	_ = d.queue.AckTask(ctx, msg.ID)
}
