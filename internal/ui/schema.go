package ui

import (
	"fmt"
	"log"
	"reflect"
	"sort"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

type schemaModel struct {
	// fields map[string]*kube.Field
	nodes map[string]*Node

	vp viewport.Model

	style     lipgloss.Style
	cursor    int
	curLineNo int
	prevNode  *Node
	curNode   *Node
	curLines  []*Line
	curGVK    schema.GroupVersionKind

	keys schemaKeyMap
	help help.Model
}

func newSchemaModel(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) *schemaModel {
	fields, err := kube.CreateFieldTree(gvk)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	nodes := createNodeTree(fields, objs, []string{})

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.Overlay0)

	vp := viewport.New(0, 0)
	m := &schemaModel{
		nodes:    nodes,
		vp:       vp,
		style:    style,
		cursor:   0,
		curGVK:   gvk,
		curLines: []*Line{},
		prevNode: nil,
		curNode:  nil,
		keys:     newSchemaKeyMap(),
		help:     help.New(),
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
	case tea.WindowSizeMsg:
		m.vp.Width = int(float64(msg.Width) * SCHEMA_WIDTH_RATIO)
		m.vp.Height = msg.Height - SCHEMA_HEIGHT_BOTTOM_MARGIN
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > SCHEMA_CURSOR_TOP {
				m.cursor--
			} else {
				m.vp.LineUp(SCHEMA_SCROLL_STEP)
			}

			if m.curIsPickable() {
				retCmd = func() tea.Msg {
					return hoverFieldMsg{candidate: m.rrrrCurNode()}
				}
			} else {
				retCmd = func() tea.Msg {
					return candidateMsg{candidate: nil}
				}
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(m.vp.Height-1, m.curLineNo-1) {
				m.cursor++
			} else {
				m.vp.LineDown(SCHEMA_SCROLL_STEP)
			}

			if m.curIsPickable() {
				retCmd = func() tea.Msg {
					return hoverFieldMsg{candidate: m.rrrrCurNode()}
				}
			} else {
				retCmd = func() tea.Msg {
					return candidateMsg{candidate: nil}
				}
			}
		case key.Matches(msg, m.keys.action):
			if m.curNode == nil {
				break
			}

			if m.curNode.Foldable() {
				m.toggleCurrentNodeFolder()
				m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
			} else { // selectable, for leaf fields
				if m.curNode.Selected {
					m.curNode.Selected = false
					retCmd = func() tea.Msg {
						return unpickFieldMsg{node: m.curNode}
					}
				} else {
					m.curNode.Selected = true
					retCmd = func() tea.Msg {
						return pickFieldMsg{node: m.curNode}
					}
				}
			}

		// BUG: when viewport is adjusted by expland all/level then fold back, the cursor is not rendered
		// reproduce - expand level of status in kind Pod(long enough) and fold
		case key.Matches(msg, m.keys.levelExpand):
			if m.curNode != nil && m.curNode.Foldable() {
				toggledExpanded := !m.curNode.Expanded
				prevNode := m.curNode
				m.toggleExpandRecursive(m.nodes, toggledExpanded, false)
				m.curLines, m.curLineNo = m.buildLines(m.nodes, m.vp.Width, 0)
				m.setCursor(prevNode.FullPath())

			}
		case key.Matches(msg, m.keys.allExpand):
			if m.curNode != nil && m.curNode.Foldable() {
				toggledExpanded := !m.curNode.Expanded
				prevNode := m.curNode
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
		fmt.Sprintf("cursor: %d, curLineNo: %d, vpYOffset: %d, vpWidth: %d", m.cursor, m.curLineNo, m.vp.YOffset, m.vp.Width),
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
	m.curNode.toggleFolder()
}

func (m *schemaModel) toggleExpandRecursive(nodes map[string]*Node, expand bool, all bool) {
	if m.curNode == nil {
		return
	}

	for _, node := range nodes {
		if all || (node.Level() == m.curNode.Level()) {
			node.setExpanded(expand)
		}

		m.toggleExpandRecursive(node.children, expand, all)
	}
}

// TODO: remove arg width
func (m *schemaModel) buildLines(nodes map[string]*Node, width int, lineNo int) ([]*Line, int) {
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
			childrenLines, childrenLineNo := m.buildLines(node.children, width, lineNo)
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
		if m.isCursor(line.index) {
			m.curNode = line.node
		}
		result.WriteString(line.render(leftPadding, m.isCursor(line.index), m.vp.Width) + "\n")
	}

	return result.String()
}

func (m *schemaModel) Reset(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) {
	m.curGVK = gvk // TODO: check if this is necessary
	fields, err := kube.CreateFieldTree(m.curGVK)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	nodes := createNodeTree(fields, objs, []string{})
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

func (m *schemaModel) rrrrCurNode() *Node {
	return m.curLines[m.cursor+m.vp.YOffset].node
}

func (m *schemaModel) curIsPickable() bool {
	return m.rrrrCurNode() != nil && !m.rrrrCurNode().Foldable() && !m.rrrrCurNode().Selected
}

func (m *schemaModel) renderTopBar() string {
	ctx, err := kube.CurrentContext()
	if err != nil {
		log.Fatalf("failed to get current context: %v", err)
	}
	ctx = lipgloss.NewStyle().Margin(0, 1).Render(ctx)
	kind := lipgloss.NewStyle().Foreground(theme.Blue).Render(m.curGVK.Kind)
	return lipgloss.JoinHorizontal(lipgloss.Left,
		ctx,
		kind,
	)
}
