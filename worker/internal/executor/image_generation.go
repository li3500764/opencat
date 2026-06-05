package executor

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
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
	} `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

func NewImageGenerationExecutor(database *db.DB, downloadsDir string) *ImageGenerationExecutor {
	return &ImageGenerationExecutor{
		db:           database,
		downloadsDir: downloadsDir,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute,
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
		req, err = e.buildImageEditRequest(ctx, taskID, apiBase, apiKey, details)
		if err != nil {
			return nil, err
		}
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

	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(strings.ToLower(contentType), "application/json") {
		return nil, fmt.Errorf(describeUnexpectedResponse(resp.StatusCode, contentType, body))
	}

	var apiResp imageGenerationAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("解析图片生成响应失败: %w；%s", err, describeUnexpectedResponse(resp.StatusCode, contentType, body))
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if apiResp.Error != nil && apiResp.Error.Message != "" {
			return nil, fmt.Errorf(apiResp.Error.Message)
		}
		if apiResp.Message != "" {
			return nil, fmt.Errorf(apiResp.Message)
		}
		return nil, fmt.Errorf("图片生成接口返回状态码 %d", resp.StatusCode)
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
) (*http.Request, error) {
	multipartReq, multipartErr := e.buildImageEditMultipartRequest(ctx, taskID, apiBase, apiKey, details)
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
	if details.Quality != "" {
		if err := writer.WriteField("quality", details.Quality); err != nil {
			return nil, err
		}
	}
	if details.Style != "" {
		if err := writer.WriteField("style", details.Style); err != nil {
			return nil, err
		}
	}

	fileWriter, err := writer.CreateFormFile("image[]", fileNameOrFallback(details.SourceImageName, "source-"+taskID+".png"))
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

func describeUnexpectedResponse(statusCode int, contentType string, body []byte) string {
	snippet := strings.TrimSpace(string(body))
	if len(snippet) > 240 {
		snippet = snippet[:240]
	}
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
