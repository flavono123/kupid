package kube

import (
	"testing"
)

func TestSupportsVerb(t *testing.T) {
	tests := []struct {
		name     string
		verbs    []string
		verb     string
		expected bool
	}{
		{
			name:     "verb exists in list",
			verbs:    []string{"list", "get", "watch"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "verb exists at end of list",
			verbs:    []string{"get", "watch", "list"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "verb exists at start of list",
			verbs:    []string{"list", "get", "watch"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "verb does not exist in list",
			verbs:    []string{"get", "watch", "create"},
			verb:     "list",
			expected: false,
		},
		{
			name:     "empty verb list",
			verbs:    []string{},
			verb:     "list",
			expected: false,
		},
		{
			name:     "nil verb list",
			verbs:    nil,
			verb:     "list",
			expected: false,
		},
		{
			name:     "single verb match",
			verbs:    []string{"list"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "single verb no match",
			verbs:    []string{"create"},
			verb:     "list",
			expected: false,
		},
		{
			name:     "case sensitive - exact match",
			verbs:    []string{"list", "get"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "case sensitive - no match",
			verbs:    []string{"List", "GET"},
			verb:     "list",
			expected: false,
		},
		{
			name:     "multiple occurrences",
			verbs:    []string{"list", "get", "list"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "all kubernetes verbs",
			verbs:    []string{"get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"},
			verb:     "list",
			expected: true,
		},
		{
			name:     "binding resource - only create",
			verbs:    []string{"create"},
			verb:     "list",
			expected: false,
		},
		{
			name:     "empty string verb",
			verbs:    []string{"list", "get"},
			verb:     "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := supportsVerb(tt.verbs, tt.verb)
			if result != tt.expected {
				t.Errorf("supportsVerb(%v, %q) = %v, want %v", tt.verbs, tt.verb, result, tt.expected)
			}
		})
	}
}
