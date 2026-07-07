package executor

import (
	"strings"
	"testing"
)

func TestSplitTextIntoChunksFinishesAtEndOfLongDocument(t *testing.T) {
	text := strings.Repeat("a", 501)

	chunks := splitTextIntoChunks(text)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}
	if got := chunks[0]; got != strings.Repeat("a", 500) {
		t.Fatalf("expected first chunk to contain 500 characters, got %d", len([]rune(got)))
	}
	if got := chunks[1]; got != strings.Repeat("a", 51) {
		t.Fatalf("expected final overlapped chunk to contain 51 characters, got %d", len([]rune(got)))
	}
}
