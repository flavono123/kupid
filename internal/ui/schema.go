package ui

import (
	"log"
	"reflect"
	"sort"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/keymap"
	"github.com/flavono123/kupid/internal/ui/message"
	"github.com/flavono123/kupid/internal/ui/result"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

type schemaModel struct {
	focused bool
	nodes   map[string]*kube.Node
	fields  map[string]*kube.Field // cache for objs changed

	vp viewport.Model

	style     lipgloss.Style
	cursor    int
	curLines  []*Line
	curLineNo int
	prevNode  *kube.Node

	gvk schema.GroupVersionKind

	keys keymap.SchemaKeyMap
	help help.Model
}

func newSchemaModel(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured, focused bool) *schemaModel {
	fields, err := kube.CreateFieldTree(gvk)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	nodes := kube.CreateNodeTree(fields, objs, []string{})

	style := lipgloss.NewStyle().
		Border(lipgloss.ThickBorder()).
		BorderForeground(theme.Blue)

	vp := viewport.New(0, 0)
	m := &schemaModel{
		focused:  focused,
		nodes:    nodes,
		fields:   fields,
		vp:       vp,
		style:    style,
		cursor:   0,
		gvk:      gvk,
		curLines: []*Line{},
		prevNode: nil,
		// curNode:  nil,
		keys: keymap.NewSchemaKeyMap(),
		help: help.New(),
	}
	m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
	content := m.renderRecursive(m.curLines)
	content = strings.TrimSuffix(content, "\n")
	vp.SetContent(content)

	return m
}

func (m *schemaModel) Init() tea.Cmd {
	return nil
}

func (m *schemaModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var retCmd tea.Cmd
	retCmd = nil

	switch msg := msg.(type) {
	case message.SetSchemaMsg:
		// TODO: should 'update' nodes, keep them whether expanded or not
		// reverted since when gvk is changed, the current message system cannot handle
		m.nodes = kube.CreateNodeTree(m.fields, msg.Objs, []string{})
		m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
	case tea.WindowSizeMsg:
		m.vp.Width = int(float64(msg.Width) * SCHEMA_WIDTH_RATIO)
		m.vp.Height = msg.Height - SCHEMA_HEIGHT_BOTTOM_MARGIN
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.Up):
			if m.cursor > SCHEMA_CURSOR_TOP {
				m.cursor--
			} else {
				m.vp.LineUp(SCHEMA_SCROLL_STEP)
			}

			if m.curIsPickable() {
				retCmd = func() tea.Msg {
					return message.HoverFieldMsg{Candidate: m.curNode()}
				}
			} else {
				retCmd = func() tea.Msg {
					return result.SetCandidateMsg{Candidate: nil}
				}
			}
		case key.Matches(msg, m.keys.Down):
			if m.cursor < min(m.vp.Height-1, m.curLineNo-1) {
				m.cursor++
			} else {
				m.vp.LineDown(SCHEMA_SCROLL_STEP)
			}

			if m.curIsPickable() {
				retCmd = func() tea.Msg {
					return message.HoverFieldMsg{Candidate: m.curNode()}
				}
			} else {
				retCmd = func() tea.Msg {
					return result.SetCandidateMsg{Candidate: nil}
				}
			}
		case key.Matches(msg, m.keys.Action):
			if m.curNode() == nil {
				break
			}

			if m.curNode().Foldable() {
				m.toggleCurrentNodeFolder()
				m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
			} else { // selectable, for leaf fields
				if m.curNode().Selected {
					m.curNode().Selected = false
					retCmd = func() tea.Msg {
						return message.UnpickFieldMsg{Node: m.curNode()}
					}
				} else {
					m.curNode().Selected = true
					retCmd = func() tea.Msg {
						return message.PickFieldMsg{Node: m.curNode()}
					}
				}
			}

		// BUG: when viewport is adjusted by expland all/level then fold back, the cursor is not rendered
		// reproduce - expand level of status in kind Pod(long enough) and fold
		case key.Matches(msg, m.keys.LevelExpand):
			node := m.curNode()
			if node != nil && node.Foldable() {
				toggledExpanded := !node.Expanded
				prevNode := node
				m.toggleExpandRecursive(m.nodes, toggledExpanded, false)
				m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
				m.setCursor(prevNode.FullPath())
			}
		case key.Matches(msg, m.keys.AllExpand):
			node := m.curNode()
			if node != nil && node.Foldable() {
				toggledExpanded := !node.Expanded
				prevNode := node
				m.toggleExpandRecursive(m.nodes, toggledExpanded, true)
				m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
				m.setCursor(prevNode.FullPath())
			}
		}
	}

	return m, retCmd
}

func (m *schemaModel) View() string {
	content := m.renderRecursive(m.curLines)
	content = strings.TrimSuffix(content, "\n")
	m.vp.SetContent(content)

	return lipgloss.JoinVertical(lipgloss.Left,
		m.renderTopBar(),
		m.style.Render(m.vp.View()),
		// m.help.View(m.keys),
		// fmt.Sprintf("vpWidth: %d", m.vp.Width),
	)
}

// utils
func (m *schemaModel) isCursor(curLineNo int) bool {
	return m.cursor == curLineNo-m.vp.YOffset
}

func (m *schemaModel) setCursor(path []string) {
	for _, line := range m.curLines {
		if reflect.DeepEqual(line.node.FullPath(), path) {
			actualIndex := line.index
			if actualIndex > m.vp.Height-1 {
				m.vp.YOffset = actualIndex - SCHEMA_EXPAND_MULTI_MARGIN
				actualIndex = SCHEMA_EXPAND_MULTI_MARGIN
			}

			m.cursor = actualIndex

			return
		}
	}
}

func (m *schemaModel) toggleCurrentNodeFolder() {
	if node := m.curNode(); node != nil {
		node.ToggleFolder()
	}
}

func (m *schemaModel) toggleExpandRecursive(nodes map[string]*kube.Node, expand bool, all bool) {
	node := m.curNode()
	if node == nil {
		return
	}

	for _, n := range nodes {
		if all || (n.Level() == node.Level()) {
			n.SetExpanded(expand)
		}

		m.toggleExpandRecursive(n.Children(), expand, all)
	}
}

// TODO: remove arg width after horizontal scrollable
func (m *schemaModel) buildLines(nodes map[string]*kube.Node, width int, lineNo int) ([]*Line, int) {
	lines := []*Line{}
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sortKeys(keys)

	for _, key := range keys {
		if key == "apiVersion" || key == "kind" {
			continue
		}

		node := nodes[key]
		line := newLine(node, width, lineNo)
		lineNo++
		lines = append(lines, line)
		if node.Expanded {
			childrenLines, childrenLineNo := m.buildLines(node.Children(), width, lineNo)
			lines = append(lines, childrenLines...)
			lineNo = childrenLineNo
		}
	}

	return lines, lineNo
}

func (m *schemaModel) renderRecursive(lines []*Line) string {
	var result strings.Builder
	leftPadding := len(strconv.Itoa(len(lines) - 1))

	for _, line := range lines {
		result.WriteString(line.render(leftPadding, m.isCursor(line.index), m.vp.Width, !m.focused) + "\n")
	}

	return result.String()
}

// TODO: split to each setter
func (m *schemaModel) Reset(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) {
	m.gvk = gvk
	fields, err := kube.CreateFieldTree(m.gvk)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	nodes := kube.CreateNodeTree(fields, objs, []string{})
	m.nodes = nodes
	m.cursor = 0
	m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
}

func sortKeys(keys []string) {
	if len(keys) == 0 {
		return
	}

	_, err := strconv.Atoi(keys[0])
	if err != nil {
		sort.Strings(keys)
	} else {
		sort.Slice(keys, func(i, j int) bool {
			numI, _ := strconv.Atoi(keys[i])
			numJ, _ := strconv.Atoi(keys[j])
			return numI < numJ
		})
	}
}

func (m *schemaModel) curNode() *kube.Node {
	return m.curLines[m.cursor+m.vp.YOffset].node
}

func (m *schemaModel) curIsPickable() bool {
	return m.curNode() != nil && !m.curNode().Foldable() && !m.curNode().Selected
}

func (m *schemaModel) renderTopBar() string {
	ctx, err := kube.CurrentContext()
	if err != nil {
		log.Fatalf("failed to get current context: %v", err)
	}
	ctx = lipgloss.NewStyle().Margin(0, 1).Render(ctx)
	kind := lipgloss.NewStyle().Foreground(theme.Blue).Render(m.gvk.Kind)
	return lipgloss.JoinHorizontal(lipgloss.Left,
		ctx,
		kind,
	)
}

func (m *schemaModel) focus() tea.Cmd {
	m.focused = true
	m.style = m.style.Border(lipgloss.ThickBorder()).BorderForeground(theme.Blue)
	// nothing to send
	return nil
}

func (m *schemaModel) blur() {
	m.focused = false
	m.style = m.style.Border(lipgloss.NormalBorder()).BorderForeground(theme.Overlay0)
}
