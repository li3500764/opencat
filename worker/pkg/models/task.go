package models

import (
	"encoding/json"
	"time"
)

// BackgroundTask 对应数据库中的 background_task 表
type BackgroundTask struct {
	ID             string          `db:"id" json:"id"`                           // 任务唯一ID (cuid)
	ProjectID      string          `db:"projectId" json:"projectId"`             // 所属项目ID
	AgentID        *string         `db:"agentId" json:"agentId"`                 // 关联的 Agent ID (可为空)
	ConversationID *string         `db:"conversationId" json:"conversationId"`   // 引发长任务的对话ID (可为空)
	UserID         string          `db:"-" json:"userId"`                        // 任务所有者用户ID (仅运行时传递，不映射数据库)
	Name           string          `db:"name" json:"name"`                       // 任务名称
	Type           string          `db:"type" json:"type"`                       // 任务类型，例如 rag-ingest
	Status         string          `db:"status" json:"status"`                   // 状态：pending / running / completed / failed
	Progress       int             `db:"progress" json:"progress"`               // 进度 (0-100)
	Details        *string         `db:"details" json:"details"`                 // 详细描述 (可为空)
	Logs           json.RawMessage `db:"logs" json:"logs"`                       // 执行日志，存储为 JSON 字符串数组格式
	SavedTime      *string         `db:"savedTime" json:"savedTime"`             // 节省的估算工时 (例如 "1.5 hours")
	CreatedAt      time.Time       `db:"createdAt" json:"createdAt"`             // 创建时间
	UpdatedAt      time.Time       `db:"updatedAt" json:"updatedAt"`             // 更新时间
}
