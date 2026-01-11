package kube

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestGetPrinterColumnsForContext_BuiltInResources(t *testing.T) {
	// Skip if no cluster available
	_, err := GetCurrentContext()
	if err != nil {
		t.Skip("No Kubernetes cluster available")
	}

	testCases := []struct {
		name     string
		gvk      schema.GroupVersionKind
		expected [][]string
	}{
		{
			name:     "Pod",
			gvk:      schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Pod"},
			expected: [][]string{{"status", "phase"}, {"metadata", "creationTimestamp"}},
		},
		{
			name:     "Deployment",
			gvk:      schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "Deployment"},
			expected: [][]string{{"status", "readyReplicas"}, {"status", "updatedReplicas"}, {"status", "availableReplicas"}, {"metadata", "creationTimestamp"}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			paths, err := GetPrinterColumnsForContext("", tc.gvk)
			assert.NoError(t, err)
			assert.NotNil(t, paths, "Expected paths but got nil")
			t.Logf("Got paths for %s: %v", tc.name, paths)
			
			// Check that expected paths are present
			for _, expected := range tc.expected {
				found := false
				for _, path := range paths {
					if len(path) == len(expected) {
						match := true
						for i := range path {
							if path[i] != expected[i] {
								match = false
								break
							}
						}
						if match {
							found = true
							break
						}
					}
				}
				assert.True(t, found, "Expected path %v not found in %v", expected, paths)
			}
		})
	}
}
