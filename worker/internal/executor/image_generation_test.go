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
		SourceImageName:     "source-task.jpg",
		SourceImageMimeType: "image/jpeg",
	}

	req, err := exec.buildImageEditMultipartRequest(
		context.Background(),
		"task-1",
		"https://example.com/v1",
		"test-key",
		details,
	)
	if err != nil {
		t.Fatalf("buildImageEditMultipartRequest returned error: %v", err)
	}

	if got := req.Header.Get("Content-Type"); !strings.HasPrefix(got, "multipart/form-data; boundary=") {
		t.Fatalf("expected multipart content type, got %s", got)
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}
	bodyText := string(body)
	if !strings.Contains(bodyText, `name="image"; filename="source-task.jpg"`) {
		t.Fatalf("expected image file field, got %s", bodyText)
	}
	if !strings.Contains(bodyText, "fake-image-bytes") {
		t.Fatalf("expected source image bytes in multipart body")
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
