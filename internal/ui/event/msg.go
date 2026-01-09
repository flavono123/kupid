package event

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/flavono123/kattle/internal/kube"
)

type CancelPickMsg struct {
	Canceled bool
	Node     *kube.Node
}

type PickGVKMsg struct {
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

// table -> result
type TableUpdatedMsg struct {
	Width int
}

// kbar(hiding) -> root
type RestoreLastSessionMsg struct{}

// -> root

type Status uint

const (
	Error Status = iota
	Warn
)

type SetStatusMsg struct {
	Message string
	Status  Status
}

type HideStatusMsg struct{}
