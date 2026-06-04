package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"opencat-worker/internal/config"
	"opencat-worker/internal/db"
	"opencat-worker/internal/dispatcher"
	"opencat-worker/internal/queue"
)

func main() {
	// 1. 设置默认结构化日志格式
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("正在启动 OpenCat Go Worker 后台服务...")

	// 2. 加载配置（环境变量）
	cfg := config.LoadConfig()
	if cfg.EncryptionKey == "" {
		slog.Warn("警告：未配置 ENCRYPTION_KEY 环境变量，用户 ApiKey 的解密功能将不可用！")
	}

	// 3. 初始化全局 Context (支持取消)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4. 连接 PostgreSQL 数据库
	slog.Info("正在连接 PostgreSQL 数据库...", "url", cfg.DatabaseURL)
	dbConn, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("连接数据库失败，退出进程", "err", err)
		os.Exit(1)
	}
	defer dbConn.Close()
	slog.Info("PostgreSQL 数据库连接成功！")

	// 5. 连接 Redis
	slog.Info("正在连接 Redis...", "url", cfg.RedisURL)
	redisQueue, err := queue.ConnectRedis(cfg.RedisURL)
	if err != nil {
		slog.Error("连接 Redis 失败，退出进程", "err", err)
		os.Exit(1)
	}
	defer redisQueue.Close()
	slog.Info("Redis 连接成功！")

	// 6. 初始化并启动任务分发器 (Dispatcher)
	disp := dispatcher.NewDispatcher(dbConn, redisQueue, cfg.Concurrency)

	// 启动分发器监听循环（在后台运行）
	dispatcherErrChan := make(chan error, 1)
	go func() {
		if err := disp.Start(ctx); err != nil {
			dispatcherErrChan <- err
		}
		close(dispatcherErrChan)
	}()

	// 7. 优雅关机 (Graceful Shutdown) 机制
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigChan:
		slog.Info("接收到系统退出信号，开始执行优雅关机...", "signal", sig.String())
	case err := <-dispatcherErrChan:
		if err != nil {
			slog.Error("分发器运行中发生严重故障", "err", err)
		}
	}

	// 通知所有 goroutine 停止拉取新任务并准备退出
	cancel()

	// 给予正在执行的任务最多 10 秒时间收尾
	slog.Info("正在等待当前正在执行的任务完成 (最多等待 10s)...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// 可以在这里做一些收尾资源的清理工作
	<-shutdownCtx.Done()
	slog.Info("OpenCat Go Worker 后台服务已成功安全退出。")
}
