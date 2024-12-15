package ui

import (
	"log"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type mainModel struct {
	schema    *schemaModel
	table     table.Model
	curGVK    schema.GroupVersionKind
	informers map[schema.GroupVersionKind]*kube.Informer
	handler   *resourceHandler
	stop      chan struct{}
}

type resourceHandler struct {
	objs []*unstructured.Unstructured // TODO: move to informer's field
}

type resourceMsg struct {
	rows []table.Row
}

func (h *resourceHandler) Add(obj interface{}) {
	u := obj.(*unstructured.Unstructured)
	h.objs = append(h.objs, u)
}

func (h *resourceHandler) Update(oldObj, newObj interface{}) {
	o := oldObj.(*unstructured.Unstructured)
	n := newObj.(*unstructured.Unstructured)

	for i, obj := range h.objs {
		if obj.GetName() == o.GetName() {
			h.objs[i] = n
			break
		}
	}

}

func (h *resourceHandler) Delete(obj interface{}) {
	u := obj.(*unstructured.Unstructured)
	for i, obj := range h.objs {
		if obj.GetName() == u.GetName() {
			h.objs = append(h.objs[:i], h.objs[i+1:]...)
			break
		}
	}
}

func (h *resourceHandler) toRows() []table.Row {
	rows := []table.Row{}
	for _, obj := range h.objs {
		rows = append(rows, table.Row{obj.GetName()})
	}
	return rows
}

func (m *mainModel) getInformer(gvk schema.GroupVersionKind) *kube.Informer {
	if m.informers[gvk] == nil {
		gvr, err := kube.GetGVR(gvk)
		if err != nil {
			return nil
		}
		m.informers[gvk] = kube.NewInformer(gvr)
	}
	return m.informers[gvk]
}

func (m *mainModel) inform(gvk schema.GroupVersionKind) tea.Cmd {
	if m.stop != nil {
		close(m.stop)
	}

	m.handler.objs = []*unstructured.Unstructured{}
	stop, err := m.getInformer(gvk).Inform(m.handler)
	if err != nil {
		return nil
	}
	m.stop = stop

	return func() tea.Msg {
		return resourceMsg{rows: m.handler.toRows()}
	}
}

func InitMainModel() *mainModel {
	initGvk := schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "Pod",
	}
	initRows := []table.Row{}
	gvr, err := kube.GetGVR(initGvk)
	if err != nil {
		log.Fatalf("failed to get gvr: %v", err)
	}
	informers := map[schema.GroupVersionKind]*kube.Informer{initGvk: kube.NewInformer(gvr)}
	initColumns := []table.Column{
		{Title: "Name", Width: 30},
	}
	tm := table.New(
		table.WithColumns(initColumns),
		table.WithRows(initRows),
		table.WithFocused(false),
	)
	handler := &resourceHandler{
		objs: []*unstructured.Unstructured{},
	}

	return &mainModel{
		schema:    InitModel(initGvk),
		curGVK:    initGvk,
		table:     tm,
		informers: informers,
		handler:   handler,
		stop:      nil,
	}
}

func (m *mainModel) Init() tea.Cmd {
	return m.inform(m.curGVK)
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	sm, cmd := m.schema.Update(msg)
	m.schema = sm.(*schemaModel)

	switch msg := msg.(type) {
	case resourceMsg:
		m.table.SetRows(msg.rows)
		return m, nil
	case selectGVKMsg:
		m.curGVK = msg.gvk
		return m, m.inform(msg.gvk)
	}

	return m, cmd
}

func (m *mainModel) View() string {
	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		m.schema.View(),
		m.table.View(),
	)
}
