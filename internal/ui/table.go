package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type tableStyles struct {
	header    lipgloss.Style
	selected  lipgloss.Style
	candidate lipgloss.Style
	debug     lipgloss.Style
}

type tableModel struct {
	keys          tableKeyMap
	cursor        int
	nodes         []*Node
	objs          []*unstructured.Unstructured
	rowsView      viewport.Model
	nameMaxWidth  int
	nodeMaxWidths []int
	candidate     *Node
	styles        tableStyles
}

func newTableModel(nodes []*Node, objs []*unstructured.Unstructured) *tableModel {
	nameMaxWidth := 4 // Name
	for _, obj := range objs {
		if len(displayName(obj)) > nameMaxWidth {
			nameMaxWidth = len(displayName(obj))
		}
	}

	m := &tableModel{
		keys:          newTableKeyMap(),
		cursor:        0,
		nodes:         nodes,
		objs:          objs,
		rowsView:      viewport.New(0, 0),
		nameMaxWidth:  nameMaxWidth,
		nodeMaxWidths: []int{},
		styles: tableStyles{
			header:    lipgloss.NewStyle().Bold(true),
			selected:  lipgloss.NewStyle().Bold(true).Foreground(theme.Mauve),
			candidate: lipgloss.NewStyle().Foreground(theme.Surface2),
			debug:     lipgloss.NewStyle().Italic(true).Foreground(theme.Surface1),
		},
	}
	return m
}

func (m *tableModel) Init() tea.Cmd {
	return nil
}

func (m *tableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.setRowsViewSize(msg)
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.isCursorTop() {
				m.cursor--
			} else {
				m.rowsView.LineUp(TABLE_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.isCursorBottom() {
				m.cursor++
			} else {
				m.rowsView.LineDown(TABLE_SCROLL_STEP)
			}
		}
	}
	return m, cmd
}

func (m *tableModel) View() string {
	content := m.renderRow()
	m.rowsView.SetContent(content)
	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderHeader(),
		m.rowsView.View(),
		m.renderDebugBar(),
	)
}

func (m *tableModel) renderHeader() string {
	var render strings.Builder
	// headers
	render.WriteString(m.cellStyle(0).Render(fmt.Sprintf("Name(%d)", m.colMaxWidth(0))))
	for i, node := range m.nodes {
		render.WriteString(m.cellStyle(i).Render(node.Name()))
	}

	if m.candidate != nil {
		return lipgloss.JoinHorizontal(
			lipgloss.Left,
			m.styles.header.Render(render.String()),
			m.styles.candidate.Render(m.candidate.Name()),
		)
	}

	return m.styles.header.Render(render.String())
}

func (m *tableModel) renderRow() string {
	var render strings.Builder

	// rows
	for i, obj := range m.objs {
		line := m.cellStyle(0).Render(displayName(obj))
		for j, node := range m.nodes {
			line += m.cellStyle(j).Render(m.val(node, obj))
		}
		if m.isCursor(i) {
			line = m.styles.selected.Render(line)
		}
		if m.candidate != nil {
			line = lipgloss.JoinHorizontal(lipgloss.Left, line, m.styles.candidate.Render(m.val(m.candidate, obj)))
		}
		render.WriteString(line)
		render.WriteString("\n")
	}

	return render.String()
}

func (m *tableModel) isCursor(index int) bool {
	return index == m.cursor+m.rowsView.YOffset
}

func (m *tableModel) setNodeMaxWidths(nodes []*Node) {
	// name
	nameMaxWidth := 4
	for _, obj := range m.objs {
		if len(displayName(obj)) > nameMaxWidth {
			nameMaxWidth = len(displayName(obj))
		}
	}
	m.nameMaxWidth = nameMaxWidth

	var nodeMaxWidths []int

	for _, node := range nodes {
		max := len(node.Name())
		for _, obj := range m.objs {
			if len(m.val(node, obj)) > max {
				max = len(m.val(node, obj))
			}
		}
		nodeMaxWidths = append(nodeMaxWidths, max)
	}

	m.nodeMaxWidths = nodeMaxWidths
}

func (m *tableModel) val(node *Node, obj *unstructured.Unstructured) string {
	val, found, err := GetNestedValueWithIndex(obj.Object, node.NodeFullPath()...)
	if err != nil || !found {
		return "-"
	}

	if str, ok := val.(string); ok && len(str) == 0 { // edge case `""`
		return "\"\""
	}

	return fmt.Sprintf("%v", val)
}

func (m *tableModel) cellStyle(col int) lipgloss.Style {
	return lipgloss.NewStyle().Margin(0, 1).Width(m.colMaxWidth(col))
}

func (m *tableModel) setNodes(nodes []*Node) {
	m.setNodeMaxWidths(nodes)
	m.nodes = nodes
}

func (m *tableModel) setObjs(objs []*unstructured.Unstructured) {
	m.objs = objs
}

func (m *tableModel) colMaxWidth(index int) int {
	if index == 0 {
		return m.nameMaxWidth
	}

	return m.nodeMaxWidths[index-1]
}

func (m *tableModel) setCandidate(candidate *Node) {
	m.candidate = candidate
}

func (m *tableModel) isCursorTop() bool {
	return m.cursor > 0
}

func (m *tableModel) isCursorBottom() bool {
	// objs size as an index(-1) and the debug/help bar(-1)
	// rowsview height as an index(-1); already adjusted for the debug/help bar
	return m.cursor < min(len(m.objs)-2, m.rowsView.Height-1)
}

func (m *tableModel) setRowsViewSize(msg tea.WindowSizeMsg) {
	m.rowsView.Width = int(float64(msg.Width) * TABLE_WIDTH_RATIO)
	m.rowsView.Height = msg.Height - 3 // HACK: topbar 1 + debug line 1 + header 1
}

func (m *tableModel) renderDebugBar() string {
	return m.styles.debug.Render(fmt.Sprintf("cursor: %d, objs: %d, yoffset: %d, candidate: %v", m.cursor, len(m.objs), m.rowsView.YOffset, m.candidate))
}
