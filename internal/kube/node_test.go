package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestNode_Pickable(t *testing.T) {
	tests := []struct {
		name     string
		node     *Node
		objs     []*unstructured.Unstructured
		expected bool
	}{
		{
			name: "has children",
			node: &Node{
				children: map[string]*Node{"child": {}},
			},
			objs:     nil, // Should not be checked
			expected: false,
		},
		{
			name: "primitive field with value",
			node: &Node{
				name: "foo",
				field: &Field{
					Type: "string",
				},
			},
			objs: []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"foo": "bar",
					},
				},
			},
			expected: true,
		},
		{
			name: "primitive field without value",
			node: &Node{
				name: "foo",
				field: &Field{
					Type: "string",
				},
			},
			objs: []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{},
				},
			},
			expected: false,
		},
		{
			name: "non-primitive field",
			node: &Node{
				name: "foo",
				field: &Field{
					Type: "map[string]string",
				},
			},
			objs: []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"foo": map[string]interface{}{"a": "b"},
					},
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.node.Pickable(tt.objs); got != tt.expected {
				t.Errorf("Node.Pickable() = %v, want %v", got, tt.expected)
			}
		})
	}
}
