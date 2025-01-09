package ui

import (
	"log"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/event"
	"github.com/flavono123/kupid/internal/ui/kbar"
	"github.com/flavono123/kupid/internal/ui/nav"
	"github.com/flavono123/kupid/internal/ui/result"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type sessionState uint

const (
	schemaView sessionState = iota
	resultView
	// kbarView
)

type Model struct {
	session       sessionState
	keys          keyMap
	vp            viewport.Model
	nav           *nav.Model
	result        *result.Model
	gvk           schema.GroupVersionKind
	controller    *kube.ResourceController
	stop          chan struct{}
	selectedNodes []*kube.Node
	kbar          *kbar.Model
}

func NewModel() *Model {
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

	return &Model{
		session:       schemaView,
		keys:          newKeyMap(),
		nav:           nav.NewModel(initGvk, controller.GetObjects(), true),
		result:        result.NewModel(controller.GetObjects()),
		vp:            viewport.New(0, 0),
		gvk:           initGvk,
		kbar:          kbar.NewModel(),
		controller:    controller,
		stop:          nil,
		selectedNodes: []*kube.Node{},
	}
}

func (m *Model) Init() tea.Cmd {
	m.inform()
	return m.listenController()
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if m.session == schemaView {
			nm, nCmd := m.nav.Update(msg)
			m.nav = nm.(*nav.Model)
			cmds = append(cmds, nCmd)
		} else if m.session == resultView && m.result.Focused() {
			rm, rCmd := m.result.Update(msg)
			m.result = rm.(*result.Model)
			cmds = append(cmds, rCmd)
		}

		if m.kbar.Visible() {
			km, kCmd := m.kbar.Update(msg)
			m.kbar = km.(*kbar.Model)
			cmds = append(cmds, kCmd)
		}

		switch {
		case key.Matches(keyMsg, m.keys.tabView):
			if m.session == schemaView {
				m.session = resultView
				m.nav.Blur()
				cmds = append(cmds, m.result.Focus())
			} else {
				m.session = schemaView
				m.result.Blur()
				cmds = append(cmds, m.nav.Focus())
			}
		case key.Matches(keyMsg, m.keys.toggleKbar):
			// var cmd tea.Cmd
			if m.kbar.Visible() {
				cmds = append(cmds, kbar.Hide)
			} else {
				cmds = append(cmds, kbar.Show)
			}
		case key.Matches(keyMsg, m.keys.quit):
			cmds = append(cmds, tea.Quit)
		}
	} else {
		rm, rCmd := m.result.Update(msg)
		m.result = rm.(*result.Model)
		cmds = append(cmds, rCmd)

		nm, nCmd := m.nav.Update(msg)
		m.nav = nm.(*nav.Model)
		cmds = append(cmds, nCmd)

		km, kCmd := m.kbar.Update(msg)
		m.kbar = km.(*kbar.Model)
		cmds = append(cmds, kCmd)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.setViewSize(msg)
	case event.UpdateObjsMsg:
		if msg.Obj != nil {
			log.Printf("updateObjsMsg since %s/%s is updated", msg.Obj.GetNamespace(), msg.Obj.GetName())
		}
		setResultCmd := func() tea.Msg {
			return result.SetResultMsg{
				Nodes:      m.selectedNodes,
				Objs:       msg.Objs,
				Picked:     false,
				PickedNode: nil,
			}
		}
		// HACK: cannot update schema change now, e.g. new annotation, deleted label key, ...
		// setSchemaMsg := func() tea.Msg {
		// 	return nav.SetNavMsg{
		// 		Objs: msg.Objs,
		// 	}
		// }
		return m, tea.Batch(
			setResultCmd,
			// setNavMsg,
			m.listenController(),
		)
	case event.PickGVKMsg:
		m.gvk = msg.GVK
		m.setController(msg.GVK)
		m.selectedNodes = []*kube.Node{}

		// TODO: should be updated by msg
		m.nav.Reset(msg.GVK, m.getController().GetObjects())

		// TODO: fix this(actually, nav.Focus() nothing return) each model should handle message
		if m.session == schemaView {
			cmds = append(cmds, m.nav.Focus())
		} else {
			cmds = append(cmds, m.result.Focus())
		}

		cmds = append(cmds, func() tea.Msg {
			return event.UpdateObjsMsg{
				Objs: m.getController().GetObjects(),
			}
		})
		cmds = append(cmds, kbar.Hide)
	case event.PickFieldMsg:
		m.selectedNodes = append(m.selectedNodes, msg.Node)
		return m, func() tea.Msg {
			return result.SetResultMsg{
				Nodes:      m.selectedNodes,
				Objs:       m.getController().GetObjects(),
				Picked:     true,
				PickedNode: msg.Node,
			}
		}
	case event.UnpickFieldMsg:
		for idx, node := range m.selectedNodes {
			if node.Name() == msg.Node.Name() {
				m.selectedNodes = append(m.selectedNodes[:idx], m.selectedNodes[idx+1:]...)
				break
			}
		}
		return m, func() tea.Msg {
			return result.SetResultMsg{
				Nodes:      m.selectedNodes,
				Objs:       m.getController().GetObjects(),
				Picked:     false,
				PickedNode: nil,
			}
		}
	case event.CancelPickMsg:
		if msg.Canceled {
			msg.Node.Selected = false
			m.selectedNodes = append(m.selectedNodes[:len(m.selectedNodes)-1], m.selectedNodes[len(m.selectedNodes):]...)
		}
	case event.HoverFieldMsg:
		return m, func() tea.Msg {
			return result.SetTableCandidateMsg{
				Candidate: msg.Candidate,
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) View() string {
	mainContent := lipgloss.JoinVertical(
		lipgloss.Left,
		lipgloss.JoinHorizontal(
			lipgloss.Left,
			m.nav.View(),
			m.result.View(),
		),
	)

	m.vp.SetContent(mainContent)

	// TODO: should render by msg
	if m.kbar.Visible() {
		// TODO: should pass by msg
		m.result.Blur()
		m.nav.Blur()

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

func (m *Model) setViewSize(msg tea.WindowSizeMsg) {
	m.vp.Width = msg.Width
	m.vp.Height = msg.Height
}

func (m *Model) setController(gvk schema.GroupVersionKind) {
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
func (m *Model) inform() tea.Cmd {
	stop, err := m.getController().Inform()
	if err != nil {
		return nil
	}
	m.stop = stop

	return nil
}

func (m *Model) getController() *kube.ResourceController {
	return m.controller
}

func (m *Model) currentFocusedView() string {
	if m.session == resultView {
		return "result"
	}
	return "schema"
}

// BUG: listen event only when selectgvk(or just once?)
func (m *Model) listenController() tea.Cmd {
	log.Printf("listen %s", m.gvk)
	return func() tea.Msg {
		match, ok := <-m.getController().EventEmitted()
		if !ok || match.Obj == nil {
			return nil
		}

		return event.UpdateObjsMsg{
			Obj:  match.Obj,
			Objs: m.getController().GetObjects(),
		}
	}
}
