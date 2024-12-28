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
	state         sessionState
	keys          keyMap
	vp            viewport.Model
	schema        *schemaModel
	result        *resultModel
	curGVK        schema.GroupVersionKind
	informers     map[schema.GroupVersionKind]*kube.Informer
	stop          chan struct{}
	selectedNodes []*Node
	kbar          *kbarModel
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

	informers[initGvk].Inform()

	return &mainModel{
		state:         schemaView,
		keys:          newKeyMap(),
		schema:        newSchemaModel(initGvk, informers[initGvk].GetObjects()),
		result:        newResultModel(informers[initGvk].GetObjects()),
		vp:            viewport.New(0, 0),
		curGVK:        initGvk,
		kbar:          newKbarModel(),
		informers:     informers,
		stop:          nil,
		selectedNodes: []*Node{},
	}
}

func (m *mainModel) Init() tea.Cmd {
	m.inform(m.curGVK)
	return func() tea.Msg {
		return resourceMsg{
			objs: m.informers[m.curGVK].GetObjects(),
		}
	}
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

		switch {
		case key.Matches(keyMsg, m.keys.tabView):
			if m.state == schemaView {
				m.state = resultView
				m.schema.blur()
				cmds = append(cmds, m.result.focus())
			} else {
				m.state = schemaView
				m.result.blur()
				cmds = append(cmds, m.schema.focus())
			}
		case key.Matches(keyMsg, m.keys.quit):
			return m, tea.Quit
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
	case tea.WindowSizeMsg:
		m.vp.Width = msg.Width
		m.vp.Height = msg.Height
	case resourceMsg:
		return m, func() tea.Msg {
			return resultMsg{
				nodes:      m.selectedNodes,
				objs:       msg.objs,
				picked:     false,
				pickedNode: nil,
			}
		}
	case selectGVKMsg:
		m.curGVK = msg.gvk
		m.inform(msg.gvk)
		m.schema.Reset(msg.gvk, m.informers[msg.gvk].GetObjects())
		m.kbar.visible = false
		m.selectedNodes = []*Node{}
		return m, func() tea.Msg {
			return resourceMsg{
				objs: m.getInformer(msg.gvk).GetObjects(),
			}
		}
	case pickFieldMsg:
		m.selectedNodes = append(m.selectedNodes, msg.node)
		return m, func() tea.Msg {
			return resultMsg{
				nodes:      m.selectedNodes,
				objs:       m.informers[m.curGVK].GetObjects(),
				picked:     true,
				pickedNode: msg.node,
			}
		}
	case unpickFieldMsg:
		for idx, node := range m.selectedNodes {
			if node.Name() == msg.node.Name() {
				m.selectedNodes = append(m.selectedNodes[:idx], m.selectedNodes[idx+1:]...)
				break
			}
		}
		return m, func() tea.Msg {
			return resultMsg{
				nodes:      m.selectedNodes,
				objs:       m.informers[m.curGVK].GetObjects(),
				picked:     false,
				pickedNode: nil,
			}
		}
	case cancelPickMsg:
		if msg.canceled {
			msg.node.Selected = false
			m.selectedNodes = append(m.selectedNodes[:len(m.selectedNodes)-1], m.selectedNodes[len(m.selectedNodes):]...)
		}
	case hoverFieldMsg:
		return m, func() tea.Msg {
			return candidateMsg{
				candidate: msg.candidate,
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *mainModel) View() string {
	mainContent := lipgloss.JoinVertical(
		lipgloss.Left,
		lipgloss.JoinHorizontal(
			lipgloss.Left,
			m.schema.View(),
			m.result.View(),
		),
	)

	m.vp.SetContent(mainContent)

	if m.kbar.visible {
		return lipgloss.Place(
			m.vp.Width,
			m.vp.Height,
			lipgloss.Center,
			UPPER_20,
			m.kbar.View(),
			lipgloss.WithWhitespaceBackground(theme.Mantle),
		)
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.vp.View(),
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

	return nil
}

func (m *mainModel) currentFocusedView() string {
	if m.state == resultView {
		return "result"
	}
	return "schema"
}
