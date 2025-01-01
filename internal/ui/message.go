package ui

import (
	"github.com/flavono123/kupid/internal/kube"
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
	node *kube.Node
}

type unpickFieldMsg struct {
	node *kube.Node
}

type hoverFieldMsg struct {
	candidate *kube.Node
}

// main
type updateObjsMsg struct {
	obj  *unstructured.Unstructured
	objs []*unstructured.Unstructured
}

// TODO: impl msg on session
// BUG: when  popup kbar result focused, "k" is inputted
// type focusSchemaMsg struct{}
// type focusResultMsg struct{}
// type showKbarMsg struct{}
// type blurHiddensMsg struct{}

// result
type resultMsg struct {
	nodes      []*kube.Node
	objs       []*unstructured.Unstructured
	picked     bool
	pickedNode *kube.Node
}

type candidateMsg struct {
	candidate *kube.Node
}

type cancelPickMsg struct {
	canceled bool
	node     *kube.Node
}
