package ui

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// kbar
type selectGVKMsg struct {
	gvk schema.GroupVersionKind
}

// schema
type pickFieldMsg struct {
	node *Node
}

type unpickFieldMsg struct {
	node *Node
}

// main
type resourceMsg struct {
	objs []*unstructured.Unstructured
}

// result
type resultMsg struct {
	nodes []*Node
	objs  []*unstructured.Unstructured
	add   bool // HACK: to avoid previous table's index out of range
}
