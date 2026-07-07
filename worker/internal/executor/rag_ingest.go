package executor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"opencat-worker/internal/crypto"
	"opencat-worker/internal/db"
	"opencat-worker/internal/reporter"
	"opencat-worker/pkg/models"
)

// RagIngestExecutor 负责执行 RAG 向量化知识库文档处理任务
type RagIngestExecutor struct {
	db *db.DB
}

// NewRagIngestExecutor 创建 RAG 向量化任务执行器
func NewRagIngestExecutor(database *db.DB) *RagIngestExecutor {
	return &RagIngestExecutor{db: database}
}

// RagIngestPayload 定义 RAG 任务在 Redis Stream 中传递的参数格式
type RagIngestPayload struct {
	DocumentID     string `json:"documentId"`
	Content        string `json:"content"`
	UserID         string `json:"userId"`
	KnowledgeBaseID string `json:"knowledgeBaseId"`
	FileName       string `json:"fileName"`
	FileType       string `json:"fileType"`
}

// Execute 接口实现：执行分块、调用大模型向量化并持久化至 PostgreSQL (pgvector)
func (e *RagIngestExecutor) Execute(ctx context.Context, task *models.BackgroundTask, rep reporter.Reporter) error {
	// 1. 解析 Payload
	if task.Details == nil || *task.Details == "" {
		return fmt.Errorf("任务 details (payload) 为空，无法执行")
	}

	var payload RagIngestPayload
	if err := json.Unmarshal([]byte(*task.Details), &payload); err != nil {
		return fmt.Errorf("解析任务 payload 失败: %w", err)
	}

	if payload.DocumentID == "" || payload.Content == "" {
		return fmt.Errorf("任务参数缺失 (documentId 或 content 为空)")
	}

	// 将解析出来的 userID 记录到 task 运行时中，便于后续异常捕获使用
	task.UserID = payload.UserID

	_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 10, "任务启动，正在更新文档处理状态...")

	// 2. 将 Document 的 status 改为 processing
	updateDocQuery := `UPDATE "Document" SET status = 'processing' WHERE id = $1`
	_, err := e.db.Pool.Exec(ctx, updateDocQuery, payload.DocumentID)
	if err != nil {
		return fmt.Errorf("更新文档状态为 processing 失败: %w", err)
	}

	// 3. 文本分块
	_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 30, "正在对文档进行语义切片...")
	chunks := splitTextIntoChunks(payload.Content)
	if len(chunks) == 0 {
		e.updateDocStatus(ctx, payload.DocumentID, "error", 0)
		return fmt.Errorf("文档内容分块后为空，无法执行向量化")
	}
	_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 45, fmt.Sprintf("分块完成，共切分为 %d 个片段。准备生成语义向量...", len(chunks)))

	// 4. 获取向量化 API Key 及 Base URL 配置
	apiKey, baseUrl, modelID, err := e.resolveEmbeddingConfig(ctx, payload.UserID)
	if err != nil {
		// 如果无法获取配置，记录警告，但我们将降级为无向量的纯文本存库
		_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 50, fmt.Sprintf("[WARNING] 无法获取向量化模型配置: %s。系统将降级为无向量的文本存储模式。", err.Error()))
	}

	var embeddings [][]float32
	if apiKey != "" {
		// 5. 批量生成向量
		embeddings, err = generateEmbeddings(ctx, chunks, apiKey, baseUrl, modelID)
		if err != nil {
			_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 60, fmt.Sprintf("[WARNING] 批量生成向量失败: %s。系统将降级为纯文本存储。", err.Error()))
		}
	}

	// 6. 批量写入数据库 DocumentChunk
	_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 70, "正在将文档分块保存到数据库...")
	
	if len(embeddings) > 0 && len(embeddings) == len(chunks) {
		// 向量写入模式：使用 pgvector 原生插入
		for i := 0; i < len(chunks); i++ {
			chunkID := generateID()
			vectorStr := floatArrayToVectorString(embeddings[i])

			insertQuery := `
				INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex")
				VALUES ($1, $2, $3, $4::vector, $5)
			`
			_, err = e.db.Pool.Exec(ctx, insertQuery, chunkID, payload.DocumentID, chunks[i], vectorStr, i)
			if err != nil {
				e.updateDocStatus(ctx, payload.DocumentID, "error", 0)
				return fmt.Errorf("向量写入 DocumentChunk 失败 (index %d): %w", i, err)
			}
		}
		_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 90, "向量数据批量存库完成。")
	} else {
		// 无向量降级模式：直接写入文本
		for i := 0; i < len(chunks); i++ {
			chunkID := generateID()
			insertQuery := `
				INSERT INTO "DocumentChunk" (id, "documentId", content, "chunkIndex")
				VALUES ($1, $2, $3, $4)
			`
			_, err = e.db.Pool.Exec(ctx, insertQuery, chunkID, payload.DocumentID, chunks[i], i)
			if err != nil {
				e.updateDocStatus(ctx, payload.DocumentID, "error", 0)
				return fmt.Errorf("降级写入 DocumentChunk 失败 (index %d): %w", i, err)
			}
		}
		_ = rep.ReportProgress(ctx, task.ID, payload.UserID, 90, "降级文本分块数据保存完成。")
	}

	// 7. 更新 Document 状态为 ready，写入总分块数
	err = e.updateDocStatus(ctx, payload.DocumentID, "ready", len(chunks))
	if err != nil {
		return fmt.Errorf("更新文档最终状态失败: %w", err)
	}

	// 8. 上报任务完成
	return rep.ReportComplete(ctx, task.ID, payload.UserID, fmt.Sprintf("%.2f hours", float64(len(chunks))*0.01), "文档向量化与索引构建已全部就绪！")
}

// updateDocStatus 辅助函数：更新 Document 记录状态与分块数
func (e *RagIngestExecutor) updateDocStatus(ctx context.Context, docID string, status string, chunkCount int) error {
	query := `UPDATE "Document" SET status = $1, "chunkCount" = $2 WHERE id = $3`
	_, err := e.db.Pool.Exec(ctx, query, status, chunkCount, docID)
	return err
}

// resolveEmbeddingConfig 根据环境变量或数据库配置获取用户的向量配置
func (e *RagIngestExecutor) resolveEmbeddingConfig(ctx context.Context, userID string) (apiKey string, baseUrl string, modelID string, err error) {
	// 1. 获取模型名（环境变量优先级最高，其次项目级，最后兜底）
	modelID = os.Getenv("EMBEDDING_MODEL")
	if modelID == "" {
		// 从用户的默认 Project 中读取 defaultEmbeddingModel
		projectQuery := `SELECT "defaultEmbeddingModel" FROM "Project" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`
		err = e.db.Pool.QueryRow(ctx, projectQuery, userID).Scan(&modelID)
		if err != nil || modelID == "" {
			modelID = "text-embedding-3-small" // 兜底
		}
	}

	// 2. 获取 Base URL (环境变量优先，其次数据库)
	baseUrl = os.Getenv("EMBEDDING_BASE_URL")

	// 3. 获取 API Key (环境变量专用优先)
	apiKey = os.Getenv("EMBEDDING_API_KEY")
	if apiKey != "" {
		return apiKey, baseUrl, modelID, nil
	}

	// 从 Settings 中查询对应的 ApiKey
	provider := os.Getenv("EMBEDDING_PROVIDER")
	if provider == "" {
		provider = "openai"
	}

	// 查询对应的 API Key 记录
	var encryptedKey, iv, dbBaseUrl string
	keyQuery := `SELECT "encryptedKey", iv, "baseUrl" FROM "ApiKey" WHERE "userId" = $1 AND provider = $2 AND "isActive" = true LIMIT 1`
	err = e.db.Pool.QueryRow(ctx, keyQuery, userID, provider).Scan(&encryptedKey, &iv, &dbBaseUrl)

	// 如果没有精确匹配上默认的 provider，尝试获取 "custom" provider
	if err != nil && provider != "custom" {
		keyQuery = `SELECT "encryptedKey", iv, "baseUrl" FROM "ApiKey" WHERE "userId" = $1 AND provider = 'custom' AND "isActive" = true LIMIT 1`
		err = e.db.Pool.QueryRow(ctx, keyQuery, userID).Scan(&encryptedKey, &iv, &dbBaseUrl)
	}

	if err == nil && encryptedKey != "" {
		// 找到用户存储的 API Key，用 AES 解密
		encKey := os.Getenv("ENCRYPTION_KEY")
		apiKey, err = crypto.Decrypt(encryptedKey, iv, encKey)
		if err != nil {
			return "", "", "", fmt.Errorf("解密用户 API Key 失败: %w", err)
		}
		if baseUrl == "" && dbBaseUrl != "" {
			baseUrl = dbBaseUrl
		}
		return apiKey, baseUrl, modelID, nil
	}

	// 最终兜底：使用系统的 OPENAI_API_KEY
	apiKey = os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", "", "", fmt.Errorf("未配置任何向量化 API Key (未检测到 EMBEDDING_API_KEY、用户 ApiKey 记录及 OPENAI_API_KEY)")
	}

	return apiKey, baseUrl, modelID, nil
}

// splitTextIntoChunks 文本分块实现（500字 Chunk Size，50字 Overlap）
func splitTextIntoChunks(text string) []string {
	// 去掉多余空白
	re := regexp.MustCompile(`\n{3,}`)
	cleanedStr := re.ReplaceAllString(text, "\n\n")
	cleanedStr = strings.TrimSpace(cleanedStr)

	cleaned := []rune(cleanedStr)
	const chunkSize = 500
	const chunkOverlap = 50

	if len(cleaned) <= chunkSize {
		return []string{cleanedStr}
	}

	var chunks []string
	start := 0

	for start < len(cleaned) {
		end := start + chunkSize
		if end < len(cleaned) {
			searchRange := cleaned[start:end]
			lastBreak := findLastBreak(searchRange)
			// 如果找到了合适的句尾/换行断点，且不会导致分块过短
			if lastBreak > chunkSize/2 {
				end = start + lastBreak + 1
			}
		}

		if end > len(cleaned) {
			end = len(cleaned)
		}

		chunkText := string(cleaned[start:end])
		chunkText = strings.TrimSpace(chunkText)
		if len(chunkText) > 0 {
			chunks = append(chunks, chunkText)
		}

		if end == len(cleaned) {
			break
		}

		start = end - chunkOverlap
	}

	return chunks
}

func findLastBreak(runes []rune) int {
	for i := len(runes) - 1; i >= 0; i-- {
		r := runes[i]
		if r == '。' || r == '\n' || r == '！' || r == '？' {
			return i
		}
		// 英文句号且后面跟着空格
		if r == '.' && i+1 < len(runes) && runes[i+1] == ' ' {
			return i
		}
	}
	return -1
}

// generateEmbeddings 调用 OpenAI 兼容的 HTTP 接口批量生成文本向量
func generateEmbeddings(ctx context.Context, inputs []string, apiKey, baseUrl, model string) ([][]float32, error) {
	apiEndpoint := "https://api.openai.com/v1/embeddings"
	if baseUrl != "" {
		// 拼接成完整的接口 URL
		parsed, err := url.Parse(baseUrl)
		if err == nil {
			if !strings.HasSuffix(parsed.Path, "/embeddings") {
				if strings.HasSuffix(parsed.Path, "/v1") || strings.HasSuffix(parsed.Path, "/v1/") {
					parsed.Path = strings.TrimSuffix(parsed.Path, "/") + "/embeddings"
				} else {
					parsed.Path = strings.TrimSuffix(parsed.Path, "/") + "/v1/embeddings"
				}
			}
			apiEndpoint = parsed.String()
		}
	}

	// 请求 Body 定义
	reqBody := map[string]interface{}{
		"model": model,
		"input": inputs,
	}
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiEndpoint, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		return nil, fmt.Errorf("API 响应错误 (状态码 %d): %v", resp.StatusCode, errData)
	}

	// 解析响应数据
	type embeddingItem struct {
		Index     int       `json:"index"`
		Embedding []float32 `json:"embedding"`
	}
	type embeddingResponse struct {
		Data []embeddingItem `json:"data"`
	}

	var apiResp embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	// 拼装结果数组，保持顺序跟 inputs 一致
	embeddings := make([][]float32, len(inputs))
	for _, item := range apiResp.Data {
		if item.Index >= 0 && item.Index < len(embeddings) {
			embeddings[item.Index] = item.Embedding
		}
	}

	return embeddings, nil
}

// generateID 模拟 cuid 相同的生成规律生成随机主键字符串
func generateID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	rand.Seed(time.Now().UnixNano())
	
	// cm + 时间戳36进制 + 随机6位36进制
	tPart := strconv.FormatInt(time.Now().UnixMilli(), 36)
	
	var rPart strings.Builder
	for i := 0; i < 6; i++ {
		rPart.WriteByte(chars[rand.Intn(len(chars))])
	}
	return "cm" + tPart + rPart.String()
}

// floatArrayToVectorString 将 float32 数组格式化为 pgvector 所需的 [x,y,z...] 文本格式
func floatArrayToVectorString(arr []float32) string {
	var sb strings.Builder
	sb.WriteString("[")
	for i, val := range arr {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(strconv.FormatFloat(float64(val), 'f', 6, 32))
	}
	sb.WriteString("]")
	return sb.String()
}
