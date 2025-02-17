package ui

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
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
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type sessionState uint

const (
	schemaView sessionState = iota
	resultView
	kbarView
)

const statusDuration = time.Millisecond * 1060

type Model struct {
	session        sessionState
	lastTabSession sessionState
	keys           keyMap
	help           help.Model
	vp             viewport.Model
	nav            *nav.Model
	result         *result.Model
	gvk            schema.GroupVersionKind
	controller     *kube.ResourceController
	stop           chan struct{}
	selectedNodes  []*kube.Node
	kbar           *kbar.Model
	status         event.Status
	statusMsg      string
	showStatus     bool
	statusTimer    *time.Timer
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

	helpKeyStyle := lipgloss.NewStyle().Foreground(theme.Lavender())
	helpDescStyle := lipgloss.NewStyle().Foreground(theme.Subtext0())
	helpSepStyle := lipgloss.NewStyle().Foreground(theme.Surface1())
	customHelp := help.Model{
		ShortSeparator: " · ",
		Styles: help.Styles{
			ShortKey:       helpKeyStyle,
			ShortDesc:      helpDescStyle,
			ShortSeparator: helpSepStyle,
		},
	}
	return &Model{
		session:        schemaView,
		lastTabSession: schemaView,
		keys:           newKeyMap(),
		help:           customHelp,
		nav:            nav.NewModel(initGvk, controller.Objects()),
		result:         result.NewModel(controller.Objects()),
		vp:             viewport.New(0, 0),
		gvk:            initGvk,
		kbar:           kbar.NewModel(),
		controller:     controller,
		stop:           nil,
		selectedNodes:  []*kube.Node{},
		statusTimer:    nil,
	}
}

func (m *Model) Init() tea.Cmd {
	m.inform()
	return m.listenController()
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if key.Matches(keyMsg, m.keys.toggleKbar) {
			if m.session == kbarView {
				m.session = m.lastTabSession
				cmds = append(cmds, kbar.Hide())
			} else {
				m.lastTabSession = m.session
				m.session = kbarView
				m.nav.Blur()
				m.result.Blur()
				cmds = append(cmds, kbar.Show)
			}
		}

		switch m.session {
		case schemaView:
			nm, nCmd := m.nav.Update(msg)
			m.nav = nm.(*nav.Model)
			cmds = append(cmds, nCmd)
		case resultView:
			rm, rCmd := m.result.Update(msg)
			m.result = rm.(*result.Model)
			cmds = append(cmds, rCmd)
		case kbarView:
			km, kCmd := m.kbar.Update(msg)
			m.kbar = km.(*kbar.Model)
			cmds = append(cmds, kCmd)
		}

		switch {
		case key.Matches(keyMsg, m.keys.tabView):
			switch m.session {
			case schemaView:
				m.lastTabSession = schemaView
				m.session = resultView
				m.nav.Blur()
				cmds = append(cmds, m.result.Focus())
			case resultView:
				m.lastTabSession = resultView
				m.session = schemaView
				m.result.Blur()
				cmds = append(cmds, m.nav.Focus())
			} // do nothing when kbar session
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
	case event.RestoreLastSessionMsg:
		m.session = m.lastTabSession
		if m.session == schemaView {
			cmds = append(cmds, m.nav.Focus())
		} else {
			cmds = append(cmds, m.result.Focus())
		}
	case event.UpdateObjsMsg:
		setResultCmd := func() tea.Msg {
			return result.SetResultMsg{
				Nodes:      m.selectedNodes,
				Objs:       msg.Objs,
				Picked:     false,
				PickedNode: nil,
			}
		}
		return m, tea.Batch(
			setResultCmd,
			m.updateNavObjs(m.controller.Objects()),
			m.listenController(),
		)
	case event.PickGVKMsg:
		m.gvk = msg.GVK
		m.setController(msg.GVK)
		m.selectedNodes = []*kube.Node{}

		cmds = append(cmds, m.setNavGVK(msg.GVK, m.controller.Objects()))
		cmds = append(cmds, m.updateObjs(nil, m.controller.Objects()))
		cmds = append(cmds, kbar.Hide())
	case event.PickFieldMsg:
		m.selectedNodes = append(m.selectedNodes, msg.Node)
		return m, func() tea.Msg {
			return result.SetResultMsg{
				Nodes:      m.selectedNodes,
				Objs:       m.controller.Objects(),
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
				Objs:       m.controller.Objects(),
				Picked:     false,
				PickedNode: nil,
			}
		}
	case event.CancelPickMsg:
		if msg.Canceled {
			msg.Node.Selected = false
			m.selectedNodes = append(m.selectedNodes[:len(m.selectedNodes)-1], m.selectedNodes[len(m.selectedNodes):]...)

			cmds = append(cmds, errCannotPick(msg.Node))
		}
	case event.HoverFieldMsg:
		return m, func() tea.Msg {
			return result.SetTableCandidateMsg{
				Candidate: msg.Candidate,
			}
		}
	case event.SetStatusMsg:
		if m.statusTimer != nil {
			m.statusTimer.Stop()
		}
		m.status = msg.Status
		m.statusMsg = msg.Message
		m.showStatus = true

		m.statusTimer = time.NewTimer(1060 * time.Millisecond)
		return m, func() tea.Msg {
			<-m.statusTimer.C
			return event.HideStatusMsg{}
		}
	case event.HideStatusMsg:
		m.showStatus = false
		m.statusMsg = ""
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

	if m.session == kbarView {
		return lipgloss.Place(
			m.vp.Width,
			m.vp.Height,
			lipgloss.Center,
			UPPER_20,
			m.kbar.View(),
			lipgloss.WithWhitespaceBackground(theme.Mantle()),
		)
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.vp.View(),
		m.renderStatusBar(),
	)
}

func (m *Model) renderStatusBar() string {
	globalHelp := m.help.View(m.keys)
	var sessionHelp string
	if m.session == schemaView {
		sessionHelp = m.help.View(m.nav.Keys())
	} else {
		sessionHelp = ""
	}

	statusBar := lipgloss.NewStyle().
		Render(globalHelp + sessionHelp)

	if m.showStatus {
		statusBar += m.statusStyle().Render(m.statusMsg)
	}

	return statusBar
}

func (m *Model) statusStyle() lipgloss.Style {
	style := lipgloss.NewStyle().MarginLeft(2).Align(lipgloss.Right)

	switch m.status {
	case event.Error:
		return style.Foreground(theme.Maroon())
	case event.Warn:
		return style.Foreground(theme.Yellow())
	default:
		return style.Foreground(theme.Subtext0())
	}
}

func errCannotPick(node *kube.Node) tea.Cmd {
	return func() tea.Msg {
		return event.SetStatusMsg{
			Message: fmt.Sprintf("cannot pick `%s'", strings.Join(node.NodeFullPath(), ".")),
			Status:  event.Error,
		}
	}
}

func (m *Model) setViewSize(msg tea.WindowSizeMsg) {
	m.vp.Width = msg.Width
	m.vp.Height = msg.Height - 1 // HACK: status bar 1
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

func (m *Model) setNavGVK(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) tea.Cmd {
	return func() tea.Msg {
		return nav.SetGVKMsg{
			GVK:  gvk,
			Objs: objs,
		}
	}
}

func (m *Model) updateNavObjs(objs []*unstructured.Unstructured) tea.Cmd {
	return func() tea.Msg {
		return nav.UpdateObjsMsg{Objs: objs}
	}
}

func (m *Model) updateObjs(updatedObj *unstructured.Unstructured, objs []*unstructured.Unstructured) tea.Cmd {
	return func() tea.Msg {
		return event.UpdateObjsMsg{
			Obj:  updatedObj,
			Objs: objs,
		}
	}
}

// TODO: ? why return?
func (m *Model) inform() tea.Cmd {
	stop, err := m.controller.Inform()
	if err != nil {
		return nil
	}
	m.stop = stop

	return nil
}

func (m *Model) listenController() tea.Cmd {
	return func() tea.Msg {
		match, ok := <-m.controller.EventEmitted()
		if !ok || match.Obj == nil {
			return nil
		}

		return event.UpdateObjsMsg{
			Obj:  match.Obj,
			Objs: m.controller.Objects(),
		}
	}
}
