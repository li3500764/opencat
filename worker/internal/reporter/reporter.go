package reporter

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"opencat-worker/internal/db"
	"opencat-worker/internal/queue"
)

// Reporter 接口定义了任务进度的汇报操作
type Reporter interface {
	ReportProgress(ctx context.Context, taskId string, userId string, progress int, log string) error
	ReportComplete(ctx context.Context, taskId string, userId string, savedTime string, finishLog string) error
	ReportFailed(ctx context.Context, taskId string, userId string, errMsg string) error
}

// DefaultReporter 是默认的进度上报器实现，同时操作 PostgreSQL 和 Redis
type DefaultReporter struct {
	db    *db.DB
	queue *queue.RedisQueue
}

// NewDefaultReporter 创建一个新的默认上报器
func NewDefaultReporter(db *db.DB, queue *queue.RedisQueue) *DefaultReporter {
	return &DefaultReporter{
		db:    db,
		queue: queue,
	}
}

// TaskProgressMessage 定义通过 Redis Pub/Sub 广播的 JSON 格式消息
type TaskProgressMessage struct {
	TaskID    string    `json:"taskId"`
	UserID    string    `json:"userId"`
	Status    string    `json:"status"`
	Progress  int       `json:"progress"`
	Log       string    `json:"log,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// ReportProgress 更新数据库中的进度并向 Redis 频道广播
func (r *DefaultReporter) ReportProgress(ctx context.Context, taskId string, userId string, progress int, log string) error {
	// 1. 更新数据库状态与日志
	err := r.db.UpdateTaskProgress(ctx, taskId, "running", progress, log)
	if err != nil {
		return fmt.Errorf("上报进度时写入数据库失败: %w", err)
	}

	// 2. 构造 Redis 广播消息
	msg := TaskProgressMessage{
		TaskID:    taskId,
		UserID:    userId,
		Status:    "running",
		Progress:  progress,
		Log:       log,
		Timestamp: time.Now(),
	}
	msgBytes, err := json.Marshal(msg)
	if err == nil {
		// 广播给 Next.js 转发到前端 SSE
		_ = r.queue.PublishProgress(ctx, string(msgBytes))
	}

	return nil
}

// ReportComplete 标记任务为完成状态并上报
func (r *DefaultReporter) ReportComplete(ctx context.Context, taskId string, userId string, savedTime string, finishLog string) error {
	// 1. 更新数据库
	err := r.db.CompleteTask(ctx, taskId, savedTime, finishLog)
	if err != nil {
		return fmt.Errorf("上报任务完成写入数据库失败: %w", err)
	}

	// 2. 广播完成消息
	msg := TaskProgressMessage{
		TaskID:    taskId,
		UserID:    userId,
		Status:    "completed",
		Progress:  100,
		Log:       finishLog,
		Timestamp: time.Now(),
	}
	msgBytes, err := json.Marshal(msg)
	if err == nil {
		_ = r.queue.PublishProgress(ctx, string(msgBytes))
	}

	return nil
}

// ReportFailed 标记任务为失败并记录错误信息
func (r *DefaultReporter) ReportFailed(ctx context.Context, taskId string, userId string, errMsg string) error {
	// 1. 更新数据库
	err := r.db.FailTask(ctx, taskId, errMsg)
	if err != nil {
		return fmt.Errorf("上报任务失败写入数据库失败: %w", err)
	}

	// 2. 广播失败消息
	msg := TaskProgressMessage{
		TaskID:    taskId,
		UserID:    userId,
		Status:    "failed",
		Progress:  0,
		Log:       fmt.Sprintf("[ERROR] 任务执行失败: %s", errMsg),
		Timestamp: time.Now(),
	}
	msgBytes, err := json.Marshal(msg)
	if err == nil {
		_ = r.queue.PublishProgress(ctx, string(msgBytes))
	}

	return nil
}
