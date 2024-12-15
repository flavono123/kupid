package ui

import (
	"log"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type keyMap struct {
	hideKbar key.Binding
	showKbar key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.showKbar,
	}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{},
	}
}

type mainModel struct {
	keys      keyMap
	schema    *schemaModel
	table     table.Model
	curGVK    schema.GroupVersionKind
	informers map[schema.GroupVersionKind]*kube.Informer
	stop      chan struct{}

	kbar     *kbarModel
	showKbar bool
}

type resourceMsg struct {
	rows []table.Row
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
	keys := keyMap{
		hideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		showKbar: key.NewBinding(
			key.WithKeys("alt+k"),
			key.WithHelp("alt(opt)+k", "kinds"),
		),
	}

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
		keys:      keys,
		schema:    InitModel(initGvk),
		curGVK:    initGvk,
		table:     tm,
		informers: informers,
		stop:      nil,
		kbar:      NewKbarModel(),
		showKbar:  false,
	}
}

func (m *mainModel) Init() tea.Cmd {
	return m.inform(m.curGVK)
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	sm, cmd := m.schema.Update(msg)
	m.schema = sm.(*schemaModel)

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.hideKbar):
			m.showKbar = !m.showKbar
			m.kbar.Reset()
			return m, tea.Batch(
				m.kbar.input.Focus(),
				textinput.Blink, // FIXME: not blinking
			)
		}

		if m.showKbar {
			var cmd tea.Cmd
			var model tea.Model
			model, cmd = m.kbar.Update(msg)
			m.kbar = model.(*kbarModel)
			switch {
			case key.Matches(msg, m.keys.hideKbar):
				m.showKbar = false
			}
			return m, cmd
		}

		return m, cmd
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
		m.showKbar = false
		// TODO: spinner status bar for long inform operation
		return m, m.inform(msg.gvk)
	}

	return m, cmd
}

func (m *mainModel) View() string {
	if m.showKbar {
		return lipgloss.Place(
			SCHEMA_WIDTH,
			SCHEMA_HEIGHT,
			lipgloss.Center,
			lipgloss.Center,
			m.kbar.View(),
			lipgloss.WithWhitespaceBackground(theme.Mantle),
		)
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.schema.View(),
		m.table.View(),
	)
}
