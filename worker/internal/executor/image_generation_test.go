package executor

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestBuildImageEditMultipartRequestUsesImageFileField(t *testing.T) {
	rootDir := t.TempDir()
	imagesDir := rootDir + "/images"
	if err := os.MkdirAll(imagesDir, 0o755); err != nil {
		t.Fatalf("mkdir images dir: %v", err)
	}

	filePath := imagesDir + "/source-task.jpg"
	if err := os.WriteFile(filePath, []byte("fake-image-bytes"), 0o644); err != nil {
		t.Fatalf("write source image: %v", err)
	}

	exec := &ImageGenerationExecutor{downloadsDir: rootDir}
	details := &imageTaskDetails{
		Model:               "gpt-image-2",
		Prompt:              "change the background",
		Size:                "1024x1024",
		SourceImageURL:      "/generated-images/source-task.jpg",
		SourceImageName:     "微信图片.jpg",
		SourceImageMimeType: "image/jpeg",
	}

	req, err := exec.buildImageEditMultipartRequest(
		context.Background(),
		"task-1",
		"https://example.com/v1",
		"test-key",
		details,
		false,
	)
	if err != nil {
		t.Fatalf("buildImageEditMultipartRequest returned error: %v", err)
	}

	if got := req.Header.Get("Content-Type"); !strings.HasPrefix(got, "multipart/form-data; boundary=") {
		t.Fatalf("expected multipart content type, got %s", got)
	}
	if got := req.Header.Get("Referer"); got != "https://www.heiyucode.com/" {
		t.Fatalf("expected heiyu referer header, got %s", got)
	}
	if got := req.Header.Get("User-Agent"); !strings.Contains(got, "Chrome/148") {
		t.Fatalf("expected browser-like user agent, got %s", got)
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}
	bodyText := string(body)
	if !strings.Contains(bodyText, `name="image[]"; filename="source-task.jpg"`) {
		t.Fatalf("expected image file field, got %s", bodyText)
	}
	if !strings.Contains(bodyText, "Content-Type: image/jpeg") {
		t.Fatalf("expected source image mime type, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `name="response_format"`) || !strings.Contains(bodyText, "b64_json") {
		t.Fatalf("expected response_format=b64_json, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `name="output_format"`) || !strings.Contains(bodyText, "png") {
		t.Fatalf("expected output_format=png, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `name="quality"`) || !strings.Contains(bodyText, "medium") {
		t.Fatalf("expected default quality=medium, got %s", bodyText)
	}
	if strings.Contains(bodyText, `name="stream"`) {
		t.Fatalf("expected non-streaming image edit request, got %s", bodyText)
	}
	if !strings.Contains(bodyText, "fake-image-bytes") {
		t.Fatalf("expected source image bytes in multipart body")
	}
}

func TestBuildImageEditMultipartRequestCanUseStreamingFallback(t *testing.T) {
	rootDir := t.TempDir()
	imagesDir := rootDir + "/images"
	if err := os.MkdirAll(imagesDir, 0o755); err != nil {
		t.Fatalf("mkdir images dir: %v", err)
	}

	filePath := imagesDir + "/source-task.jpg"
	if err := os.WriteFile(filePath, []byte("fake-image-bytes"), 0o644); err != nil {
		t.Fatalf("write source image: %v", err)
	}

	exec := &ImageGenerationExecutor{downloadsDir: rootDir}
	details := &imageTaskDetails{
		Model:               "gpt-image-2",
		Prompt:              "change the background",
		Size:                "1024x1024",
		SourceImageURL:      "/generated-images/source-task.jpg",
		SourceImageName:     "source-task.jpg",
		SourceImageMimeType: "image/jpeg",
	}

	req, err := exec.buildImageEditMultipartRequest(
		context.Background(),
		"task-1",
		"https://example.com/v1",
		"test-key",
		details,
		true,
	)
	if err != nil {
		t.Fatalf("buildImageEditMultipartRequest returned error: %v", err)
	}
	if got := req.Header.Get("Accept"); got != "text/event-stream" {
		t.Fatalf("expected streaming accept header, got %s", got)
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}
	bodyText := string(body)
	if !strings.Contains(bodyText, `name="stream"`) || !strings.Contains(bodyText, "true") {
		t.Fatalf("expected stream=true, got %s", bodyText)
	}
}

func TestBuildImageEditJSONRequestUsesImagesArray(t *testing.T) {
	exec := &ImageGenerationExecutor{}
	details := &imageTaskDetails{
		Model:               "gpt-image-2",
		Prompt:              "change the background",
		Size:                "1024x1024",
		SourceImageName:     "source.jpg",
		SourceImageMimeType: "image/jpeg",
	}

	req, err := exec.buildImageEditJSONRequest(
		context.Background(),
		"https://example.com/v1",
		"test-key",
		details,
		[]byte("abc"),
	)
	if err != nil {
		t.Fatalf("buildImageEditJSONRequest returned error: %v", err)
	}

	if got := req.Method; got != http.MethodPost {
		t.Fatalf("expected POST, got %s", got)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected application/json content type, got %s", got)
	}

	var payload map[string]any
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		t.Fatalf("decode request body: %v", err)
	}

	images, ok := payload["images"].([]any)
	if !ok || len(images) != 1 {
		t.Fatalf("expected one image reference, got %#v", payload["images"])
	}

	firstImage, ok := images[0].(map[string]any)
	if !ok {
		t.Fatalf("expected object image reference, got %#v", images[0])
	}

	imageURL, ok := firstImage["image_url"].(string)
	if !ok {
		t.Fatalf("expected image_url string, got %#v", firstImage["image_url"])
	}
	if !strings.HasPrefix(imageURL, "data:image/jpeg;base64,") {
		t.Fatalf("expected data URL, got %s", imageURL)
	}
}

func TestDescribeUnexpectedResponseIncludesBodySnippet(t *testing.T) {
	body := []byte("error code: upstream timeout")
	message := describeUnexpectedResponse(http.StatusOK, "text/plain", body)

	if !strings.Contains(message, "非 JSON") {
		t.Fatalf("expected non-JSON hint, got %s", message)
	}
	if !strings.Contains(message, "text/plain") {
		t.Fatalf("expected content type in message, got %s", message)
	}
	if !strings.Contains(message, "error code: upstream timeout") {
		t.Fatalf("expected body snippet in message, got %s", message)
	}
}

func TestNormalizeImageResponseParsesServerSentEvents(t *testing.T) {
	body := []byte(": heartbeat\n\n:  data: {\"data\":[{\"b64_json\":\"QUJDRA==\",\"revised_prompt\":\"done\"}]}\n\ndata: [DONE]\n")

	result, err := normalizeImageResponse("text/event-stream", http.StatusOK, body)
	if err != nil {
		t.Fatalf("normalizeImageResponse returned error: %v", err)
	}

	if result == nil || len(result.Data) != 1 {
		t.Fatalf("expected one image result, got %#v", result)
	}
	if result.Data[0].B64JSON != "QUJDRA==" {
		t.Fatalf("expected b64 image, got %#v", result.Data[0])
	}
}

func TestNormalizeImageResponseReportsUpstreamErrorType(t *testing.T) {
	body := []byte(`{"error":{"message":"上游服务暂时不可用","type":"upstream_error"}}`)

	_, err := normalizeImageResponse("application/json", http.StatusBadGateway, body)
	if err == nil {
		t.Fatal("expected error")
	}

	message := err.Error()
	if !strings.Contains(message, "上游服务暂时不可用") || !strings.Contains(message, "upstream_error") || !strings.Contains(message, "502") {
		t.Fatalf("expected detailed upstream error, got %s", message)
	}
}

func TestBuildImageAPIBaseURLRewritesHeiyuWebHostToSLBHost(t *testing.T) {
	baseURL := "https://www.heiyucode.com"
	got := buildImageAPIBaseURL(&baseURL)
	want := "https://api-slb.heiyucode.com/v1"

	if got != want {
		t.Fatalf("expected %s, got %s", want, got)
	}
}
