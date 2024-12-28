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

type hoverFieldMsg struct {
	candidate *Node
}

// main
type resourceMsg struct {
	objs []*unstructured.Unstructured
}

// result
type resultMsg struct {
	nodes []*Node
	objs  []*unstructured.Unstructured
}

type candidateMsg struct {
	candidate *Node
}
