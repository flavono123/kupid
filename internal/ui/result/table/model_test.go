package table

import (
	"testing"

	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestTruncate(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		max      int
		expected string
	}{
		{
			name:     "short string",
			input:    "hello",
			max:      10,
			expected: "hello",
		},
		{
			name:     "exact length",
			input:    "hello",
			max:      5,
			expected: "hello",
		},
		{
			name:     "long string",
			input:    "hello world",
			max:      5,
			expected: "he...",
		},
		{
			name:     "very long string",
			input:    "this is a very long string",
			max:      10,
			expected: "this is...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncate(tt.input, tt.max)
			if got != tt.expected {
				t.Errorf("truncate(%q, %d) = %q, want %q", tt.input, tt.max, got, tt.expected)
			}
		})
	}
}

func TestWillOverWidth(t *testing.T) {
	// Setup
	longStr := ""
	for i := 0; i < 100; i++ {
		longStr += "a"
	}

	objs := []*unstructured.Unstructured{
		{
			Object: map[string]interface{}{
				"long": longStr,
			},
		},
	}

	m := NewModel(nil, objs)
	m.rowsView.Width = 100 // ample space

	// Create a node using CreateNodeTree
	fieldTree := map[string]*kube.Field{
		"long": {
			Name: "long",
			Type: "string",
		},
	}
	nodes := kube.CreateNodeTree(fieldTree, objs, nil)
	longNode := nodes["long"]

	// Test: WillOverWidth should return false because maxWidth is capped at 50
	// TableWidth is initially small (just name column).
	// 50 + small < 100 - 9
	if m.WillOverWidth(longNode) {
		t.Errorf("WillOverWidth(longNode) = true, want false (should be capped)")
	}

	// Verify maxWidth is capped
	if width := m.maxWidth(longNode); width != MAX_COLUMN_WIDTH {
		t.Errorf("maxWidth(longNode) = %d, want %d", width, MAX_COLUMN_WIDTH)
	}
}
