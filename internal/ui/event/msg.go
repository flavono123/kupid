// TODO: remove all msg would go for each "handling"(case of switch msg.(type)) model's
package event

import (
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type CancelPickMsg struct {
	Canceled bool
	Node     *kube.Node
}

type SelectGVKMsg struct {
	GVK schema.GroupVersionKind
}

type PickFieldMsg struct {
	Node *kube.Node
}

type UnpickFieldMsg struct {
	Node *kube.Node
}

type HoverFieldMsg struct {
	Candidate *kube.Node
}

type UpdateObjsMsg struct {
	Obj  *unstructured.Unstructured
	Objs []*unstructured.Unstructured
}
