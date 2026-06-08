package executor

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"time"

	"opencat-worker/internal/crypto"
	"opencat-worker/internal/db"
	"opencat-worker/internal/reporter"
	"opencat-worker/pkg/models"
)

type ImageGenerationExecutor struct {
	db           *db.DB
	downloadsDir string
	httpClient   *http.Client
}

type imageTaskDetails struct {
	Kind                string `json:"kind,omitempty"`
	Mode                string `json:"mode,omitempty"`
	APIKeyID            string `json:"apiKeyId,omitempty"`
	Model               string `json:"model,omitempty"`
	Prompt              string `json:"prompt,omitempty"`
	Size                string `json:"size,omitempty"`
	Quality             string `json:"quality,omitempty"`
	Style               string `json:"style,omitempty"`
	SourceImageURL      string `json:"sourceImageUrl,omitempty"`
	SourceImageName     string `json:"sourceImageName,omitempty"`
	SourceImageMimeType string `json:"sourceImageMimeType,omitempty"`
	ImageURL            string `json:"imageUrl,omitempty"`
	RemoteImageURL      string `json:"remoteImageUrl,omitempty"`
	RevisedPrompt       string `json:"revisedPrompt,omitempty"`
	Error               string `json:"error,omitempty"`
}

type imageGenerationAPIResponse struct {
	Data []struct {
		URL           string `json:"url"`
		B64JSON       string `json:"b64_json"`
		RevisedPrompt string `json:"revised_prompt"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type,omitempty"`
	} `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

func NewImageGenerationExecutor(database *db.DB, downloadsDir string) *ImageGenerationExecutor {
	return &ImageGenerationExecutor{
		db:           database,
		downloadsDir: downloadsDir,
		httpClient: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}
}

func (e *ImageGenerationExecutor) Execute(ctx context.Context, task *models.BackgroundTask, rep reporter.Reporter) error {
	if task.Details == nil || *task.Details == "" {
		return fmt.Errorf("任务 details 为空，无法执行图片生成")
	}

	var details imageTaskDetails
	if err := json.Unmarshal([]byte(*task.Details), &details); err != nil {
		return fmt.Errorf("解析图片任务 details 失败: %w", err)
	}

	if details.APIKeyID == "" || details.Model == "" || details.Prompt == "" || details.Size == "" {
		return fmt.Errorf("图片任务缺少必要参数")
	}

	userID, err := e.db.GetTaskUserID(ctx, task.ID)
	if err != nil {
		return fmt.Errorf("获取图片任务所属用户失败: %w", err)
	}
	task.UserID = userID

	_ = rep.ReportProgress(ctx, task.ID, userID, 10, "图片任务已启动，正在加载密钥配置...")

	keyRecord, err := e.db.GetAPIKeyByID(ctx, details.APIKeyID, userID)
	if err != nil {
		return fmt.Errorf("读取图片生成 API Key 失败: %w", err)
	}

	apiKey, err := crypto.Decrypt(keyRecord.EncryptedKey, keyRecord.IV, os.Getenv("ENCRYPTION_KEY"))
	if err != nil {
		return fmt.Errorf("解密图片生成 API Key 失败: %w", err)
	}

	apiBase := buildImageAPIBaseURL(keyRecord.BaseURL)

	_ = rep.ReportProgress(ctx, task.ID, userID, 25, "已加载图片服务配置，准备向模型提供商发起请求...")

	result, err := e.callImageProvider(ctx, task.ID, apiBase, apiKey, &details)
	if err != nil {
		_ = e.markTaskFailed(ctx, task.ID, &details, err.Error())
		return err
	}

	_ = rep.ReportProgress(ctx, task.ID, userID, 75, "图片已生成，正在保存到服务器...")

	persistedURL, err := e.persistGeneratedImage(task.ID, result)
	if err != nil {
		_ = e.markTaskFailed(ctx, task.ID, &details, err.Error())
		return fmt.Errorf("保存生成图片失败: %w", err)
	}

	details.ImageURL = persistedURL
	details.RemoteImageURL = result.remoteURL
	details.RevisedPrompt = result.revisedPrompt
	details.Error = ""

	if err := e.db.UpdateTaskDetails(ctx, task.ID, details); err != nil {
		return fmt.Errorf("更新图片任务详情失败: %w", err)
	}

	return rep.ReportComplete(ctx, task.ID, userID, "-", "图片任务已完成，结果已保存。")
}

type normalizedImageResult struct {
	remoteURL     string
	revisedPrompt string
	bytes         []byte
	extension     string
}

func (e *ImageGenerationExecutor) callImageProvider(
	ctx context.Context,
	taskID string,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
) (*normalizedImageResult, error) {
	var (
		req *http.Request
		err error
	)

	if details.Mode == "image-to-image" {
		return e.callImageEditProvider(ctx, taskID, apiBase, apiKey, details)
	} else {
		req, err = e.buildImageGenerationRequest(ctx, apiBase, apiKey, details)
		if err != nil {
			return nil, err
		}
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用图片生成服务失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取图片生成响应失败: %w", err)
	}

	apiResp, err := normalizeImageResponse(resp.Header.Get("Content-Type"), resp.StatusCode, body)
	if err != nil {
		return nil, err
	}

	if len(apiResp.Data) == 0 {
		return nil, fmt.Errorf("图片生成接口未返回任何图片")
	}

	item := apiResp.Data[0]
	if item.URL != "" {
		return e.downloadRemoteImage(ctx, item.URL, item.RevisedPrompt)
	}
	if item.B64JSON != "" {
		bytes, err := base64.StdEncoding.DecodeString(item.B64JSON)
		if err != nil {
			return nil, fmt.Errorf("解码图片 base64 失败: %w", err)
		}
		return &normalizedImageResult{
			remoteURL:     "data:image/png;base64," + item.B64JSON,
			revisedPrompt: item.RevisedPrompt,
			bytes:         bytes,
			extension:     "png",
		}, nil
	}

	return nil, fmt.Errorf("图片生成接口返回了无法识别的图片格式")
}

func (e *ImageGenerationExecutor) callImageEditProvider(
	ctx context.Context,
	taskID string,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
) (*normalizedImageResult, error) {
	var lastErr error
	attempts := []bool{true, false, true}
	for index, stream := range attempts {
		result, err := e.callImageEditProviderOnce(ctx, taskID, apiBase, apiKey, details, stream)
		if err == nil {
			return result, nil
		}
		lastErr = err
		if index == len(attempts)-1 || !shouldRetryImageEdit(err) {
			break
		}
		time.Sleep(time.Duration(index+1) * 2 * time.Second)
	}
	return nil, lastErr
}

func (e *ImageGenerationExecutor) callImageEditProviderOnce(
	ctx context.Context,
	taskID string,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
	stream bool,
) (*normalizedImageResult, error) {
	req, err := e.buildImageEditRequest(ctx, taskID, apiBase, apiKey, details, stream)
	if err != nil {
		return nil, err
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用图片生成服务失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取图片生成响应失败: %w", err)
	}

	apiResp, err := normalizeImageResponse(resp.Header.Get("Content-Type"), resp.StatusCode, body)
	if err != nil {
		return nil, err
	}

	if len(apiResp.Data) == 0 {
		return nil, fmt.Errorf("图片生成接口未返回任何图片")
	}

	item := apiResp.Data[0]
	if item.URL != "" {
		return e.downloadRemoteImage(ctx, item.URL, item.RevisedPrompt)
	}
	if item.B64JSON != "" {
		bytes, err := base64.StdEncoding.DecodeString(item.B64JSON)
		if err != nil {
			return nil, fmt.Errorf("解码图片 base64 失败: %w", err)
		}
		return &normalizedImageResult{
			remoteURL:     "data:image/png;base64," + item.B64JSON,
			revisedPrompt: item.RevisedPrompt,
			bytes:         bytes,
			extension:     "png",
		}, nil
	}

	return nil, fmt.Errorf("图片生成接口返回了无法识别的图片格式")
}

func (e *ImageGenerationExecutor) buildImageGenerationRequest(
	ctx context.Context,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
) (*http.Request, error) {
	payload := map[string]any{
		"model":  details.Model,
		"prompt": details.Prompt,
		"size":   details.Size,
		"n":      1,
	}
	if details.Quality != "" {
		payload["quality"] = details.Quality
	}
	if details.Style != "" {
		payload["style"] = details.Style
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("序列化图片生成请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+"/images/generations", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建图片生成请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func (e *ImageGenerationExecutor) buildImageEditRequest(
	ctx context.Context,
	taskID string,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
	stream bool,
) (*http.Request, error) {
	multipartReq, multipartErr := e.buildImageEditMultipartRequest(ctx, taskID, apiBase, apiKey, details, stream)
	if multipartErr == nil {
		return multipartReq, nil
	}

	if details.SourceImageURL == "" {
		return nil, fmt.Errorf("图生图任务缺少参考图")
	}

	sourcePath := filepath.Join(e.downloadsDir, "images", filepath.Base(details.SourceImageURL))
	sourceBytes, err := os.ReadFile(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("读取参考图失败: %w", err)
	}

	jsonReq, jsonErr := e.buildImageEditJSONRequest(ctx, apiBase, apiKey, details, sourceBytes)
	if jsonErr == nil {
		return jsonReq, nil
	}

	return nil, fmt.Errorf("构建图生图请求失败: multipart=%v; json=%v", multipartErr, jsonErr)
}

func (e *ImageGenerationExecutor) buildImageEditMultipartRequest(
	ctx context.Context,
	taskID string,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
	stream bool,
) (*http.Request, error) {
	if details.SourceImageURL == "" {
		return nil, fmt.Errorf("图生图任务缺少参考图")
	}

	sourcePath := filepath.Join(e.downloadsDir, "images", filepath.Base(details.SourceImageURL))
	sourceBytes, err := os.ReadFile(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("读取参考图失败: %w", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	if err := writer.WriteField("model", details.Model); err != nil {
		return nil, err
	}
	if err := writer.WriteField("prompt", details.Prompt); err != nil {
		return nil, err
	}
	if err := writer.WriteField("size", details.Size); err != nil {
		return nil, err
	}
	if err := writer.WriteField("n", "1"); err != nil {
		return nil, err
	}
	if err := writer.WriteField("response_format", "b64_json"); err != nil {
		return nil, err
	}
	if err := writer.WriteField("output_format", "png"); err != nil {
		return nil, err
	}
	quality := strings.TrimSpace(details.Quality)
	if quality == "" {
		quality = "medium"
	}
	if err := writer.WriteField("quality", quality); err != nil {
		return nil, err
	}
	if stream {
		if err := writer.WriteField("stream", "true"); err != nil {
			return nil, err
		}
	}
	if details.Style != "" {
		if err := writer.WriteField("style", details.Style); err != nil {
			return nil, err
		}
	}

	fileWriter, err := createImageFormFilePart(writer, "image[]", filepath.Base(sourcePath), details.SourceImageMimeType)
	if err != nil {
		return nil, fmt.Errorf("创建参考图表单字段失败: %w", err)
	}
	if _, err := fileWriter.Write(sourceBytes); err != nil {
		return nil, fmt.Errorf("写入参考图表单字段失败: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("结束图片编辑表单失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+"/images/edits", &body)
	if err != nil {
		return nil, fmt.Errorf("创建图片编辑请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Referer", "https://www.heiyucode.com/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
	if stream {
		req.Header.Set("Accept", "text/event-stream")
	} else {
		req.Header.Set("Accept", "application/json")
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req, nil
}

func (e *ImageGenerationExecutor) buildImageEditJSONRequest(
	ctx context.Context,
	apiBase string,
	apiKey string,
	details *imageTaskDetails,
	sourceBytes []byte,
) (*http.Request, error) {
	mimeType := details.SourceImageMimeType
	if strings.TrimSpace(mimeType) == "" {
		mimeType = "image/png"
	}

	payload := map[string]any{
		"model":  details.Model,
		"prompt": details.Prompt,
		"size":   details.Size,
		"images": []map[string]string{
			{
				"image_url": fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(sourceBytes)),
			},
		},
	}
	if details.Quality != "" {
		payload["quality"] = details.Quality
	}
	if details.Style != "" {
		payload["style"] = details.Style
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("序列化图生图 JSON 请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+"/images/edits", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建图生图 JSON 请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func (e *ImageGenerationExecutor) downloadRemoteImage(
	ctx context.Context,
	imageURL string,
	revisedPrompt string,
) (*normalizedImageResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建图片下载请求失败: %w", err)
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("下载生成图片失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("下载生成图片失败，状态码 %d", resp.StatusCode)
	}

	bytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取生成图片失败: %w", err)
	}

	return &normalizedImageResult{
		remoteURL:     imageURL,
		revisedPrompt: revisedPrompt,
		bytes:         bytes,
		extension:     inferExtension(resp.Header.Get("Content-Type"), imageURL),
	}, nil
}

func (e *ImageGenerationExecutor) persistGeneratedImage(taskID string, result *normalizedImageResult) (string, error) {
	imagesDir := filepath.Join(e.downloadsDir, "images")
	if err := os.MkdirAll(imagesDir, 0o755); err != nil {
		return "", fmt.Errorf("创建图片目录失败: %w", err)
	}

	fileName := fmt.Sprintf("result-%s.%s", taskID, result.extension)
	filePath := filepath.Join(imagesDir, fileName)
	if err := os.WriteFile(filePath, result.bytes, 0o644); err != nil {
		return "", fmt.Errorf("写入图片文件失败: %w", err)
	}

	return "/generated-images/" + fileName, nil
}

func (e *ImageGenerationExecutor) markTaskFailed(
	ctx context.Context,
	taskID string,
	details *imageTaskDetails,
	errMsg string,
) error {
	details.Error = errMsg
	return e.db.UpdateTaskDetails(ctx, taskID, details)
}

func buildImageAPIBaseURL(baseURL *string) string {
	cleanBaseURL := "https://api.openai.com"
	if baseURL != nil && strings.TrimSpace(*baseURL) != "" {
		cleanBaseURL = strings.TrimRight(strings.TrimSpace(*baseURL), "/")
	}
	cleanBaseURL = strings.Replace(cleanBaseURL, "https://www.heiyucode.com", "https://api-slb.heiyucode.com", 1)
	if strings.HasSuffix(cleanBaseURL, "/v1") || strings.Contains(cleanBaseURL, "/v1/") {
		return cleanBaseURL
	}
	return cleanBaseURL + "/v1"
}

func inferExtension(contentType string, imageURL string) string {
	lowerContentType := strings.ToLower(contentType)
	switch {
	case strings.Contains(lowerContentType, "jpeg"):
		return "jpg"
	case strings.Contains(lowerContentType, "webp"):
		return "webp"
	case strings.Contains(lowerContentType, "gif"):
		return "gif"
	case strings.Contains(lowerContentType, "png"):
		return "png"
	}

	lowerURL := strings.ToLower(imageURL)
	switch {
	case strings.Contains(lowerURL, ".jpg"), strings.Contains(lowerURL, ".jpeg"):
		return "jpg"
	case strings.Contains(lowerURL, ".webp"):
		return "webp"
	case strings.Contains(lowerURL, ".gif"):
		return "gif"
	default:
		return "png"
	}
}

func fileNameOrFallback(name string, fallback string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func normalizeImageResponse(contentType string, statusCode int, body []byte) (*imageGenerationAPIResponse, error) {
	lowerContentType := strings.ToLower(contentType)
	var apiResp imageGenerationAPIResponse

	if strings.Contains(lowerContentType, "text/event-stream") {
		parsed, err := parseImageEventStream(body)
		if err != nil {
			return nil, err
		}
		apiResp = *parsed
	} else {
		if !strings.Contains(lowerContentType, "application/json") {
			return nil, fmt.Errorf(describeUnexpectedResponse(statusCode, contentType, body))
		}
		if err := json.Unmarshal(body, &apiResp); err != nil {
			return nil, fmt.Errorf("解析图片生成响应失败: %w；%s", err, describeUnexpectedResponse(statusCode, contentType, body))
		}
	}

	if statusCode < 200 || statusCode >= 300 {
		return nil, imageAPIError(statusCode, &apiResp)
	}

	if apiResp.Error != nil && apiResp.Error.Message != "" {
		return nil, imageAPIError(statusCode, &apiResp)
	}
	if apiResp.Message != "" && len(apiResp.Data) == 0 {
		return nil, imageAPIError(statusCode, &apiResp)
	}

	return &apiResp, nil
}

func parseImageEventStream(body []byte) (*imageGenerationAPIResponse, error) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 1024), maxImageResponseBytes)
	var lastData string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		dataIndex := strings.Index(line, "data:")
		if dataIndex < 0 {
			continue
		}

		payload := strings.TrimSpace(line[dataIndex+len("data:"):])
		if payload == "" || payload == "[DONE]" {
			continue
		}
		lastData = payload
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("读取图片流式响应失败: %w", err)
	}
	if lastData == "" {
		return nil, fmt.Errorf("图片流式响应没有返回有效 data 事件")
	}

	var apiResp imageGenerationAPIResponse
	if err := json.Unmarshal([]byte(lastData), &apiResp); err != nil {
		return nil, fmt.Errorf("解析图片流式响应失败: %w；data=%q", err, trimForLog(lastData, 240))
	}

	return &apiResp, nil
}

func imageAPIError(statusCode int, apiResp *imageGenerationAPIResponse) error {
	if apiResp != nil && apiResp.Error != nil && apiResp.Error.Message != "" {
		if apiResp.Error.Type != "" {
			return fmt.Errorf("图片生成接口返回错误: status=%d type=%s message=%s", statusCode, apiResp.Error.Type, apiResp.Error.Message)
		}
		return fmt.Errorf("图片生成接口返回错误: status=%d message=%s", statusCode, apiResp.Error.Message)
	}
	if apiResp != nil && apiResp.Message != "" {
		return fmt.Errorf("图片生成接口返回错误: status=%d message=%s", statusCode, apiResp.Message)
	}
	return fmt.Errorf("图片生成接口返回状态码 %d", statusCode)
}

func shouldRetryImageEdit(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	retryHints := []string{
		"context deadline exceeded",
		"Client.Timeout exceeded",
		"status=502",
		"type=upstream_error",
		"type=server_error",
		"server_error",
		"上游请求失败",
	}
	for _, hint := range retryHints {
		if strings.Contains(message, hint) {
			return true
		}
	}

	return false
}

func describeUnexpectedResponse(statusCode int, contentType string, body []byte) string {
	snippet := trimForLog(strings.TrimSpace(string(body)), 240)
	if snippet == "" {
		snippet = "(empty body)"
	}

	return fmt.Sprintf(
		"图片服务返回了非 JSON 响应，status=%d content-type=%q body=%q",
		statusCode,
		contentType,
		snippet,
	)
}

func trimForLog(value string, maxLength int) string {
	if len(value) <= maxLength {
		return value
	}
	return value[:maxLength]
}

const maxImageResponseBytes = 32 * 1024 * 1024

func createImageFormFilePart(writer *multipart.Writer, fieldName string, fileName string, mimeType string) (io.Writer, error) {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, escapeQuotes(fieldName), escapeQuotes(fileName)))

	contentType := strings.TrimSpace(mimeType)
	if contentType == "" {
		contentType = inferMimeTypeFromFileName(fileName)
	}
	header.Set("Content-Type", contentType)

	return writer.CreatePart(header)
}

func inferMimeTypeFromFileName(fileName string) string {
	extension := strings.ToLower(filepath.Ext(fileName))
	switch extension {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "image/png"
	}
}

func escapeQuotes(value string) string {
	return strings.NewReplacer("\\", "\\\\", `"`, "\\\"").Replace(value)
}
