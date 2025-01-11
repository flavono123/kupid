package event

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

const statusDuration = time.Millisecond * 1060

func ShowStatus() tea.Cmd {
	return tea.Tick(statusDuration, func(t time.Time) tea.Msg {
		return HideStatusMsg{}
	})
}

type HideStatusMsg struct{}
