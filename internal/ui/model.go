package ui

import (
	"log"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type sessionState uint

const (
	schemaView sessionState = iota
	resultView
)

type mainModel struct {
	state          sessionState
	keys           keyMap
	vp             viewport.Model
	schema         *schemaModel
	result         *resultModel
	curGVK         schema.GroupVersionKind
	informers      map[schema.GroupVersionKind]*kube.Informer
	stop           chan struct{}
	selectedFields []*kube.Field
	kbar           *kbarModel
}

func InitModel() *mainModel {
	initGvk := schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "Pod",
	}
	gvr, err := kube.GetGVR(initGvk)
	if err != nil {
		log.Fatalf("failed to get gvr: %v", err)
	}
	informers := map[schema.GroupVersionKind]*kube.Informer{
		initGvk: kube.NewInformer(gvr),
	}

	return &mainModel{
		state:          schemaView,
		keys:           newKeyMap(),
		schema:         newSchemaModel(initGvk),
		result:         newResultModel(informers[initGvk].GetObjects()),
		vp:             viewport.New(WIDTH, HEIGHT),
		curGVK:         initGvk,
		kbar:           newKbarModel(),
		informers:      informers,
		stop:           nil,
		selectedFields: []*kube.Field{},
	}
}

func (m *mainModel) Init() tea.Cmd {
	return m.inform(m.curGVK)
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if m.state == schemaView {
			sm, sCmd := m.schema.Update(msg)
			m.schema = sm.(*schemaModel)
			cmds = append(cmds, sCmd)
		} else if m.state == resultView && m.result.focused {
			rm, rCmd := m.result.Update(msg)
			m.result = rm.(*resultModel)
			cmds = append(cmds, rCmd)
		}

		if key.Matches(keyMsg, m.keys.tabView) {
			if m.state == schemaView {
				m.state = resultView
				m.result.focus()
			} else {
				m.state = schemaView
				m.result.blur()
			}
		}
	} else {
		rm, rCmd := m.result.Update(msg)
		m.result = rm.(*resultModel)
		cmds = append(cmds, rCmd)

		sm, sCmd := m.schema.Update(msg)
		m.schema = sm.(*schemaModel)
		cmds = append(cmds, sCmd)
	}

	km, kCmd := m.kbar.Update(msg)
	m.kbar = km.(*kbarModel)
	cmds = append(cmds, kCmd)

	switch msg := msg.(type) {
	case resourceMsg:
		return m, func() tea.Msg {
			return resultMsg{
				fields: m.selectedFields,
				objs:   msg.objs,
			}
		}
	case selectGVKMsg:
		m.curGVK = msg.gvk
		m.schema.Reset(msg.gvk)
		m.kbar.visible = false
		m.selectedFields = []*kube.Field{}
		return m, m.inform(msg.gvk)
	case pickFieldMsg:
		m.selectedFields = append(m.selectedFields, &msg.field)
		return m, func() tea.Msg {
			return resultMsg{
				fields: m.selectedFields,
				objs:   m.informers[m.curGVK].GetObjects(),
				add:    true,
			}
		}
	case unpickFieldMsg:
		for idx, field := range m.selectedFields {
			if field.Name == msg.field.Name {
				m.selectedFields = append(m.selectedFields[:idx], m.selectedFields[idx+1:]...)
				break
			}
		}
		return m, func() tea.Msg {
			return resultMsg{
				fields: m.selectedFields,
				objs:   m.informers[m.curGVK].GetObjects(),
				add:    false,
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *mainModel) View() string {
	mainContent := lipgloss.JoinVertical(
		lipgloss.Left,
		m.schema.View(),
		m.result.View(),
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
		m.currentFocusedView(),
	)
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

	stop, err := m.getInformer(gvk).Inform()
	if err != nil {
		return nil
	}
	m.stop = stop

	return func() tea.Msg {
		return resourceMsg{
			objs: m.getInformer(gvk).GetObjects(),
		}
	}
}

func (m *mainModel) currentFocusedView() string {
	if m.state == resultView {
		return "result"
	}
	return "schema"
}
