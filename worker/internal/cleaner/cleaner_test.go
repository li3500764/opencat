package cleaner

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFindExpiredFilesIncludesNestedDirectories(t *testing.T) {
	rootDir := t.TempDir()
	nestedDir := filepath.Join(rootDir, "images")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("mkdir nested dir: %v", err)
	}

	now := time.Date(2026, 6, 5, 12, 0, 0, 0, time.UTC)
	maxAge := 7 * 24 * time.Hour

	topLevelExpired := filepath.Join(rootDir, "old-top.png")
	nestedExpired := filepath.Join(nestedDir, "old-nested.png")
	nestedFresh := filepath.Join(nestedDir, "fresh.png")

	for _, filePath := range []string{topLevelExpired, nestedExpired, nestedFresh} {
		if err := os.WriteFile(filePath, []byte("test"), 0o644); err != nil {
			t.Fatalf("write file %s: %v", filePath, err)
		}
	}

	oldTime := now.Add(-maxAge - time.Hour)
	freshTime := now.Add(-2 * time.Hour)

	if err := os.Chtimes(topLevelExpired, oldTime, oldTime); err != nil {
		t.Fatalf("chtimes top level: %v", err)
	}
	if err := os.Chtimes(nestedExpired, oldTime, oldTime); err != nil {
		t.Fatalf("chtimes nested expired: %v", err)
	}
	if err := os.Chtimes(nestedFresh, freshTime, freshTime); err != nil {
		t.Fatalf("chtimes nested fresh: %v", err)
	}

	expiredFiles, err := findExpiredFiles(rootDir, maxAge, now)
	if err != nil {
		t.Fatalf("findExpiredFiles: %v", err)
	}

	expected := map[string]bool{
		topLevelExpired: true,
		nestedExpired:   true,
	}

	if len(expiredFiles) != len(expected) {
		t.Fatalf("expected %d expired files, got %d: %#v", len(expected), len(expiredFiles), expiredFiles)
	}

	for _, filePath := range expiredFiles {
		if !expected[filePath] {
			t.Fatalf("unexpected expired file %s", filePath)
		}
		delete(expected, filePath)
	}

	if len(expected) != 0 {
		t.Fatalf("missing expired files: %#v", expected)
	}
}
