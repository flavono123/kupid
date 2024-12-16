package ui

import (
	"github.com/charmbracelet/bubbles/table"
	"github.com/flavono123/kupid/internal/kube"
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

// main(table)
type resourceMsg struct {
	rows []table.Row
}
