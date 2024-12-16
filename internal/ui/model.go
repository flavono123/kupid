package ui

import (
	"log"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type mainModel struct {
	keys           keyMap
	vp             viewport.Model
	schema         *schemaModel
	table          table.Model
	curGVK         schema.GroupVersionKind
	informers      map[schema.GroupVersionKind]*kube.Informer
	stop           chan struct{}
	selectedFields []*kube.Field
	kbar           *kbarModel
}



func toRows(objs []*unstructured.Unstructured) []table.Row {
	rows := []table.Row{}
	for _, obj := range objs {
		rows = append(rows, table.Row{obj.GetName()})
	}
	return rows
}

func maxColumnWidth(rows []table.Row, col int) int {
	max := 0
	for _, row := range rows {
		if len(row[col]) > max {
			max = len(row[col])
		}
	}
	return max
}

func (m *mainModel) getInformer(gvk schema.GroupVersionKind) *kube.Informer {
	if m.informers[gvk] == nil {
		gvr, err := kube.GetGVR(gvk)
		if err != nil {
			return nil // HACK: to be treated
		}
		m.informers[gvk] = kube.NewInformer(gvr)
	}
	return m.informers[gvk]
}

func (m *mainModel) inform(gvk schema.GroupVersionKind) tea.Cmd {
	if m.stop != nil {
		close(m.stop)
	}

	stop, err := m.getInformer(gvk).Inform()
	if err != nil {
		return nil
	}
	m.stop = stop

	return func() tea.Msg {
		return resourceMsg{rows: toRows(m.getInformer(gvk).GetObjects())}
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
		{
			Title: "Name",
			Width: maxColumnWidth(initRows, 0),
		},
	}
	tm := table.New(
		table.WithColumns(initColumns),
		table.WithRows(initRows),
		table.WithFocused(false),
	)

	return &mainModel{
		keys:           newKeyMap(),
		vp:             viewport.New(WIDTH, HEIGHT),
		schema:         InitModel(initGvk),
		curGVK:         initGvk,
		table:          tm,
		informers:      informers,
		stop:           nil,
		selectedFields: []*kube.Field{},
		kbar:           NewKbarModel(),
	}
}

func (m *mainModel) Init() tea.Cmd {
	return m.inform(m.curGVK)
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	sm, sCmd := m.schema.Update(msg)
	m.schema = sm.(*schemaModel)
	km, kCmd := m.kbar.Update(msg)
	m.kbar = km.(*kbarModel)

	switch msg := msg.(type) {
	case resourceMsg:
		m.table.SetColumns(
			[]table.Column{
				{
					Title: "Name",
					Width: maxColumnWidth(msg.rows, 0),
				},
			},
		)
		m.table.SetRows(msg.rows)
		return m, nil
	case selectGVKMsg:
		m.curGVK = msg.gvk
		m.schema.Reset(msg.gvk)
		m.kbar.visible = false
		// TODO: spinner status bar for long inform operation
		return m, m.inform(msg.gvk)
	case pickFieldMsg:
		m.selectedFields = append(m.selectedFields, &msg.field)
	case unpickFieldMsg:
		for idx, field := range m.selectedFields {
			if field.Name == msg.field.Name { // HACK: maybe uuid needed?
				m.selectedFields = append(m.selectedFields[:idx], m.selectedFields[idx+1:]...)
				break
			}
		}
	}

	return m, tea.Batch(sCmd, kCmd)
}

// HACK: tmp
func (m *mainModel) renderSelectedFields() string {
	selectedFields := []string{}
	for _, field := range m.selectedFields {
		selectedFields = append(selectedFields, field.Name)
	}
	return strings.Join(selectedFields, ", ")
}

func (m *mainModel) View() string {
	mainContent := lipgloss.JoinVertical(
		lipgloss.Left,
		m.schema.View(),
		m.table.View(),
	)
	m.vp.SetContent(mainContent)

	if m.kbar.visible {
		return lipgloss.Place(
			WIDTH,
			HEIGHT,
			lipgloss.Center,
			UPPER_20,
			m.kbar.View(),
			lipgloss.WithWhitespaceBackground(theme.Mantle),
		)
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.vp.View(),
		m.renderSelectedFields(),
	)
}
