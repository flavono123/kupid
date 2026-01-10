package kube

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestJsonPathToFieldPath(t *testing.T) {
	tests := []struct {
		name     string
		jsonPath string
		expected []string
	}{
		{
			name:     "simple path",
			jsonPath: ".spec.replicas",
			expected: []string{"spec", "replicas"},
		},
		{
			name:     "nested path",
			jsonPath: ".status.conditions.type",
			expected: []string{"status", "conditions", "type"},
		},
		{
			name:     "path with array index",
			jsonPath: ".status.conditions[0].type",
			expected: []string{"status", "conditions", "*", "type"},
		},
		{
			name:     "metadata path",
			jsonPath: ".metadata.creationTimestamp",
			expected: []string{"metadata", "creationTimestamp"},
		},
		{
			name:     "empty path",
			jsonPath: "",
			expected: nil,
		},
		{
			name:     "single field",
			jsonPath: ".status",
			expected: []string{"status"},
		},
		{
			name:     "without leading dot",
			jsonPath: "spec.replicas",
			expected: []string{"spec", "replicas"},
		},
		{
			name:     "path with multiple array indices",
			jsonPath: ".spec.containers[0].ports[0].containerPort",
			expected: []string{"spec", "containers", "*", "ports", "*", "containerPort"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := jsonPathToFieldPath(tt.jsonPath)
			assert.Equal(t, tt.expected, result)
		})
	}
}
