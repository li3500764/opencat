package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"opencat-worker/pkg/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB 封装 PostgreSQL 连接池
type DB struct {
	Pool *pgxpool.Pool
}

// Connect 初始化 pgx 连接池
func Connect(ctx context.Context, databaseURL string) (*DB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("解析数据库连接串失败: %w", err)
	}

	// 设置连接池最大连接数等配置
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("创建数据库连接池失败: %w", err)
	}

	// 测试连接
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("连接数据库测试失败: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close 关闭数据库连接池
func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// GetTask 获取特定的后台任务记录
func (db *DB) GetTask(ctx context.Context, id string) (*models.BackgroundTask, error) {
	task := &models.BackgroundTask{}
	query := `SELECT id, "projectId", "agentId", "conversationId", name, type, status, progress, details, logs, "savedTime", "createdAt", "updatedAt" 
	          FROM "BackgroundTask" WHERE id = $1`
	
	err := db.Pool.QueryRow(ctx, query, id).Scan(
		&task.ID,
		&task.ProjectID,
		&task.AgentID,
		&task.ConversationID,
		&task.Name,
		&task.Type,
		&task.Status,
		&task.Progress,
		&task.Details,
		&task.Logs,
		&task.SavedTime,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return task, nil
}

// UpdateTaskProgress 更新任务状态、进度并追加一条日志
func (db *DB) UpdateTaskProgress(ctx context.Context, id string, status string, progress int, newLog string) error {
	// 1. 获取现有任务以读取当前的 logs 数组
	task, err := db.GetTask(ctx, id)
	if err != nil {
		return fmt.Errorf("更新进度时读取任务失败: %w", err)
	}

	var logs []string
	if len(task.Logs) > 0 {
		if err := json.Unmarshal(task.Logs, &logs); err != nil {
			// 如果解析失败，则重置为空数组
			logs = []string{}
		}
	}

	// 2. 追加新日志
	if newLog != "" {
		logs = append(logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), newLog))
	}

	// 3. 重新序列化为 JSON
	updatedLogs, err := json.Marshal(logs)
	if err != nil {
		return fmt.Errorf("序列化日志失败: %w", err)
	}

	// 4. 更新到数据库 (Prisma 需要遵循 updatedAt 规则)
	query := `UPDATE "BackgroundTask" 
	          SET status = $1, progress = $2, logs = $3, "updatedAt" = $4 
	          WHERE id = $5`
	
	_, err = db.Pool.Exec(ctx, query, status, progress, updatedLogs, time.Now(), id)
	if err != nil {
		return fmt.Errorf("更新数据库任务记录失败: %w", err)
	}

	return nil
}

func (db *DB) GetTaskUserID(ctx context.Context, taskID string) (string, error) {
	var userID string
	query := `
		SELECT p."userId"
		FROM "BackgroundTask" bt
		INNER JOIN "Project" p ON p.id = bt."projectId"
		WHERE bt.id = $1
	`

	if err := db.Pool.QueryRow(ctx, query, taskID).Scan(&userID); err != nil {
		return "", fmt.Errorf("查询任务所属用户失败: %w", err)
	}

	return userID, nil
}

type APIKeyRecord struct {
	EncryptedKey string
	IV           string
	BaseURL      *string
}

func (db *DB) GetAPIKeyByID(ctx context.Context, apiKeyID string, userID string) (*APIKeyRecord, error) {
	query := `
		SELECT "encryptedKey", iv, "baseUrl"
		FROM "ApiKey"
		WHERE id = $1 AND "userId" = $2 AND "isActive" = true
		LIMIT 1
	`

	record := &APIKeyRecord{}
	if err := db.Pool.QueryRow(ctx, query, apiKeyID, userID).Scan(&record.EncryptedKey, &record.IV, &record.BaseURL); err != nil {
		return nil, fmt.Errorf("查询 API Key 记录失败: %w", err)
	}

	return record, nil
}

func (db *DB) UpdateTaskDetails(ctx context.Context, id string, details any) error {
	serialized, err := json.Marshal(details)
	if err != nil {
		return fmt.Errorf("序列化任务详情失败: %w", err)
	}

	query := `UPDATE "BackgroundTask" SET details = $1, "updatedAt" = $2 WHERE id = $3`
	_, err = db.Pool.Exec(ctx, query, string(serialized), time.Now(), id)
	if err != nil {
		return fmt.Errorf("更新任务详情失败: %w", err)
	}

	return nil
}

// CompleteTask 标记任务完成
func (db *DB) CompleteTask(ctx context.Context, id string, savedTime string, newLog string) error {
	task, err := db.GetTask(ctx, id)
	if err != nil {
		return fmt.Errorf("完成任务时读取记录失败: %w", err)
	}

	var logs []string
	if len(task.Logs) > 0 {
		_ = json.Unmarshal(task.Logs, &logs)
	}
	if newLog != "" {
		logs = append(logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), newLog))
	}
	updatedLogs, _ := json.Marshal(logs)

	query := `UPDATE "BackgroundTask" 
	          SET status = 'completed', progress = 100, "savedTime" = $1, logs = $2, "updatedAt" = $3 
	          WHERE id = $4`
	
	_, err = db.Pool.Exec(ctx, query, savedTime, updatedLogs, time.Now(), id)
	if err != nil {
		return fmt.Errorf("标记任务完成失败: %w", err)
	}
	return nil
}

// FailTask 标记任务失败，记录错误日志
func (db *DB) FailTask(ctx context.Context, id string, errMsg string) error {
	task, err := db.GetTask(ctx, id)
	if err != nil {
		return fmt.Errorf("失败任务时读取记录失败: %w", err)
	}

	var logs []string
	if len(task.Logs) > 0 {
		_ = json.Unmarshal(task.Logs, &logs)
	}
	logs = append(logs, fmt.Sprintf("[%s] [ERROR] 任务执行失败: %s", time.Now().Format("15:04:05"), errMsg))
	updatedLogs, _ := json.Marshal(logs)

	nextDetails := errMsg
	if task.Details != nil && *task.Details != "" {
		var detailsObject map[string]any
		if err := json.Unmarshal([]byte(*task.Details), &detailsObject); err == nil && detailsObject != nil {
			detailsObject["error"] = errMsg
			if marshaled, marshalErr := json.Marshal(detailsObject); marshalErr == nil {
				nextDetails = string(marshaled)
			}
		}
	}

	query := `UPDATE "BackgroundTask" 
	          SET status = 'failed', details = $1, logs = $2, "updatedAt" = $3 
	          WHERE id = $4`
	
	_, err = db.Pool.Exec(ctx, query, nextDetails, updatedLogs, time.Now(), id)
	if err != nil {
		return fmt.Errorf("标记任务失败记录错误时失败: %w", err)
	}
	return nil
}

// GetAllProjects 获取系统中所有项目的 ID
func (db *DB) GetAllProjects(ctx context.Context) ([]string, error) {
	query := `SELECT id FROM "Project"`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// CreateCleanupTask 创建一条全局的清理任务记录，返回任务 ID
func (db *DB) CreateCleanupTask(ctx context.Context, projectID string, name string, taskType string) (string, error) {
	id := fmt.Sprintf("clean-%d-%s", time.Now().UnixNano(), projectID[:4])

	query := `INSERT INTO "BackgroundTask" (id, "projectId", name, type, status, progress, details, logs, "createdAt", "updatedAt")
	          VALUES ($1, $2, $3, $4, 'running', 0, '', '[]'::json, $5, $6)`
	
	_, err := db.Pool.Exec(ctx, query, id, projectID, name, taskType, time.Now(), time.Now())
	if err != nil {
		return "", fmt.Errorf("创建 BackgroundTask 记录失败: %w", err)
	}
	return id, nil
}

// CompleteCleanupTask 完成清理任务并写入详细信息与日志
func (db *DB) CompleteCleanupTask(ctx context.Context, id string, details string, savedTime string, newLog string) error {
	task, err := db.GetTask(ctx, id)
	if err != nil {
		return fmt.Errorf("完成清理任务时读取记录失败: %w", err)
	}

	var logs []string
	if len(task.Logs) > 0 {
		_ = json.Unmarshal(task.Logs, &logs)
	}
	if newLog != "" {
		logs = append(logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), newLog))
	}
	updatedLogs, _ := json.Marshal(logs)

	query := `UPDATE "BackgroundTask" 
	          SET status = 'completed', progress = 100, details = $1, "savedTime" = $2, logs = $3, "updatedAt" = $4 
	          WHERE id = $5`
	
	_, err = db.Pool.Exec(ctx, query, details, savedTime, updatedLogs, time.Now(), id)
	if err != nil {
		return fmt.Errorf("标记清理任务完成失败: %w", err)
	}
	return nil
}
