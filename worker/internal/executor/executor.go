package executor

import (
	"context"
	"opencat-worker/internal/reporter"
	"opencat-worker/pkg/models"
)

// Executor 定义了后台任务执行器的通用接口
type Executor interface {
	// Execute 执行指定的后台长任务
	// ctx 用于控制任务超时与取消
	// task 是待处理的任务模型
	// rep 是进度上报器，用于实时推送执行日志和进度
	Execute(ctx context.Context, task *models.BackgroundTask, rep reporter.Reporter) error
}
