package cleaner

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"opencat-worker/internal/db"
)

// StartFileCleaner 启动定时清理文件的后台任务
// dbConn: PostgreSQL 连接 pool 实例
// dirPath: 目标清理目录
// maxAge: 文件的最大保存时间（例如 7 * 24 * time.Hour）
// interval: 定时器触发间隔（例如 12 * time.Hour）
func StartFileCleaner(ctx context.Context, dbConn *db.DB, dirPath string, maxAge time.Duration, interval time.Duration) {
	slog.Info("文件清理器服务已初始化", "dir", dirPath, "maxAge", maxAge.String(), "interval", interval.String())

	// 启动后台协程
	go func() {
		// 1. 服务启动时立即执行一次清理
		cleanFiles(ctx, dbConn, dirPath, maxAge)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("收到退出信号，文件清理器后台任务已停止")
				return
			case <-ticker.C:
				cleanFiles(ctx, dbConn, dirPath, maxAge)
			}
		}
	}()
}

// cleanFiles 扫描指定目录并删除过期的文件，同时与数据库 BackgroundTask 联动展示
func cleanFiles(ctx context.Context, dbConn *db.DB, dirPath string, maxAge time.Duration) {
	startTime := time.Now()
	slog.Info("开始执行过期文件清理...", "dir", dirPath)

	// 1. 扫描出所有有效的项目，并分别为其创建 BackgroundTask 记录以提高前端交互性
	projectIDs, err := dbConn.GetAllProjects(ctx)
	if err != nil {
		slog.Error("清理任务中获取项目列表失败，改为仅进行本地静默清理", "err", err)
	}

	taskIDs := make(map[string]string) // key: projectID, value: taskID
	if len(projectIDs) > 0 {
		for _, pid := range projectIDs {
			tid, err := dbConn.CreateCleanupTask(ctx, pid, "系统过期文件定时清理", "file_cleanup")
			if err != nil {
				slog.Error("创建长任务监控记录失败", "project", pid, "err", err)
			} else {
				taskIDs[pid] = tid
				_ = dbConn.UpdateTaskProgress(ctx, tid, "running", 10, "任务启动成功，开始扫描过期缓存文件...")
			}
		}
	}

	// 2. 检查清理目录是否存在
	info, err := os.Stat(dirPath)
	if err != nil {
		errMsg := fmt.Sprintf("获取目录状态失败: %v", err)
		slog.Error("获取目录状态失败", "dir", dirPath, "err", err)
		for _, tid := range taskIDs {
			_ = dbConn.FailTask(ctx, tid, errMsg)
		}
		return
	}
	if !info.IsDir() {
		errMsg := fmt.Sprintf("配置的下载文件路径不是一个有效目录: %s", dirPath)
		slog.Error("配置的路径不是一个目录", "path", dirPath)
		for _, tid := range taskIDs {
			_ = dbConn.FailTask(ctx, tid, errMsg)
		}
		return
	}

	// 更新各任务进度
	for _, tid := range taskIDs {
		_ = dbConn.UpdateTaskProgress(ctx, tid, "running", 40, "正在读取下载目录，准备比对文件最后修改时间...")
	}

	// 3. 读取目录
	files, err := os.ReadDir(dirPath)
	if err != nil {
		errMsg := fmt.Sprintf("读取目录内容失败: %v", err)
		slog.Error("读取目录内容失败", "dir", dirPath, "err", err)
		for _, tid := range taskIDs {
			_ = dbConn.FailTask(ctx, tid, errMsg)
		}
		return
	}

	now := time.Now()
	deletedCount := 0
	var totalDeletedSize int64 = 0
	var deletedFileNames []string

	for _, file := range files {
		// 跳过子目录，只清理具体生成的文件
		if file.IsDir() {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())

		// 获取文件详细元数据
		fileInfo, err := file.Info()
		if err != nil {
			slog.Warn("获取文件详情失败，跳过该文件", "path", filePath, "err", err)
			continue
		}

		// 计算文件的生存时间（根据最后修改时间）
		age := now.Sub(fileInfo.ModTime())
		if age > maxAge {
			fileSize := fileInfo.Size()
			// 执行删除操作
			if err := os.Remove(filePath); err != nil {
				slog.Error("删除过期文件失败", "path", filePath, "err", err)
			} else {
				slog.Info("成功删除过期文件", "path", filePath, "age", age.String(), "size", fileSize)
				deletedCount++
				totalDeletedSize += fileSize
				deletedFileNames = append(deletedFileNames, file.Name())
			}
		}
	}

	// 4. 清理完成，更新进度和统计信息
	duration := time.Since(startTime)
	durationStr := fmt.Sprintf("%.2fs", duration.Seconds())
	logText := fmt.Sprintf("本次清理共扫描并删除 %d 个超期文件，释放磁盘空间 %.2f MB", deletedCount, float64(totalDeletedSize)/(1024*1024))
	
	var detailsText string
	if deletedCount > 0 {
		detailsText = fmt.Sprintf("成功清理 %d 个 7 天前生成的过期图片与文档。已删除文件列表如下：\n%s", 
			deletedCount, strings.Join(deletedFileNames, "\n"))
	} else {
		detailsText = "未扫描到生存期超过 7 天的过期图片与文档，无文件需要清理。"
	}

	for _, tid := range taskIDs {
		_ = dbConn.CompleteCleanupTask(ctx, tid, detailsText, durationStr, logText)
	}

	slog.Info("过期文件清理执行完毕！", 
		"dir", dirPath, 
		"deletedCount", deletedCount, 
		"totalDeletedSize", totalDeletedSize,
		"duration", durationStr,
	)
}
