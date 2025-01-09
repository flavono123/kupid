package nav

import (
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type SetGVKMsg struct {
	GVK  schema.GroupVersionKind
	Objs []*unstructured.Unstructured
}

type SetNodesMsg struct {
	Nodes []*kube.Node
}

type UpdateObjsMsg struct {
	Objs []*unstructured.Unstructured
}
