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
type pickFieldMsg struct {
	field kube.Field
}

type unpickFieldMsg struct {
	field kube.Field
}

// main
type resourceMsg struct {
	objs []*unstructured.Unstructured
}

// result
type resultMsg struct {
	fields []*kube.Field
	objs   []*unstructured.Unstructured
}
