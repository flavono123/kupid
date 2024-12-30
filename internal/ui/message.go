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
type setSchemaMsg struct {
	// TODO: refactor, pull down to sub package
	// if gvk is not changed, actual schema fields, nodes, are not changed
	// so following may not required and the message name would be more specific
	// for only updating by objects informing
	// nodes []*Node
	objs []*unstructured.Unstructured
}
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
type updateObjsMsg struct {
	obj  *unstructured.Unstructured
	objs []*unstructured.Unstructured
}

// result
type resultMsg struct {
	nodes      []*Node
	objs       []*unstructured.Unstructured
	picked     bool
	pickedNode *Node
}

type candidateMsg struct {
	candidate *Node
}

type cancelPickMsg struct {
	canceled bool
	node     *Node
}
