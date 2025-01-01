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
	// kbarView
)

type mainModel struct {
	session       sessionState
	keys          keyMap
	vp            viewport.Model
	schema        *schemaModel
	result        *resultModel
	gvk           schema.GroupVersionKind
	controller    *kube.ResourceController
	stop          chan struct{}
	selectedNodes []*kube.Node
	kbar          *kbarModel
}

func InitModel() *mainModel {
	initGvk := schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "Service",
	}
	gvr, err := kube.GetGVR(initGvk)
	if err != nil {
		log.Fatalf("failed to get gvr: %v", err)
	}
	controller := kube.NewResourceController(gvr)
	controller.Inform()

	return &mainModel{
		session:       schemaView,
		keys:          newKeyMap(),
		schema:        newSchemaModel(initGvk, controller.GetObjects(), true),
		result:        newResultModel(controller.GetObjects()),
		vp:            viewport.New(0, 0),
		gvk:           initGvk,
		kbar:          newKbarModel(),
		controller:    controller,
		stop:          nil,
		selectedNodes: []*kube.Node{},
	}
}

func (m *mainModel) Init() tea.Cmd {
	m.inform()
	return m.listenController()
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if m.session == schemaView {
			sm, sCmd := m.schema.Update(msg)
			m.schema = sm.(*schemaModel)
			cmds = append(cmds, sCmd)
		} else if m.session == resultView && m.result.focused {
			rm, rCmd := m.result.Update(msg)
			m.result = rm.(*resultModel)
			cmds = append(cmds, rCmd)
		}

		switch {
		case key.Matches(keyMsg, m.keys.tabView):
			if m.session == schemaView {
				m.session = resultView
				m.schema.blur()
				cmds = append(cmds, m.result.focus())
			} else {
				m.session = schemaView
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

	// TODO: only update when kbar is focused(after refactoring message design for session)
	km, kCmd := m.kbar.Update(msg)
	m.kbar = km.(*kbarModel)
	cmds = append(cmds, kCmd)

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.vp.Width = msg.Width
		m.vp.Height = msg.Height
	case updateObjsMsg:
		if msg.obj != nil {
			log.Printf("updateObjsMsg since %s/%s is updated", msg.obj.GetNamespace(), msg.obj.GetName())
		}
		setResultCmd := func() tea.Msg {
			return resultMsg{
				nodes:      m.selectedNodes,
				objs:       msg.objs,
				picked:     false,
				pickedNode: nil,
			}
		}
		setSchemaMsg := func() tea.Msg {
			return setSchemaMsg{
				objs: msg.objs,
			}
		}
		return m, tea.Batch(
			setResultCmd,
			setSchemaMsg,
			m.listenController(),
		)
	case selectGVKMsg:
		m.gvk = msg.gvk
		m.setController(msg.gvk)

		m.schema.Reset(msg.gvk, m.getController().GetObjects())
		// TODO: should pass by msg
		m.kbar.visible = false
		m.selectedNodes = []*kube.Node{}

		if m.session == schemaView {
			m.schema.focus()
		} else {
			m.result.focus()
		}
		return m, func() tea.Msg {
			return updateObjsMsg{
				objs: m.getController().GetObjects(),
			}
		}
	case pickFieldMsg:
		m.selectedNodes = append(m.selectedNodes, msg.node)
		return m, func() tea.Msg {
			return resultMsg{
				nodes:      m.selectedNodes,
				objs:       m.getController().GetObjects(),
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
				objs:       m.getController().GetObjects(),
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

	// TODO: should render by msg
	if m.kbar.visible {
		// TODO: should pass by msg
		m.result.blur()
		m.schema.blur()

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

func (m *mainModel) setController(gvk schema.GroupVersionKind) {
	if m.stop != nil {
		close(m.stop)
	}
	gvr, err := kube.GetGVR(gvk)
	if err != nil {
		return
	}
	m.controller = kube.NewResourceController(gvr)
	m.inform()
}

// TODO: ? why return?
func (m *mainModel) inform() tea.Cmd {
	stop, err := m.getController().Inform()
	if err != nil {
		return nil
	}
	m.stop = stop

	return nil
}

func (m *mainModel) getController() *kube.ResourceController {
	return m.controller
}

func (m *mainModel) currentFocusedView() string {
	if m.session == resultView {
		return "result"
	}
	return "schema"
}

// BUG: listen event only when selectgvk(or just once?)
func (m *mainModel) listenController() tea.Cmd {
	log.Printf("listen %s", m.gvk)
	return func() tea.Msg {
		match, ok := <-m.getController().EventEmitted()
		if !ok || match.Obj == nil {
			return nil
		}

		return updateObjsMsg{
			obj:  match.Obj,
			objs: m.getController().GetObjects(),
		}
	}
}
