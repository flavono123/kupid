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

type tableModel struct {
	// msg
	keys   tableKeyMap
	cursor int

	// view
	nodes         []*Node
	objs          []*unstructured.Unstructured
	rowsView      viewport.Model
	nameMaxWidth  int
	nodeMaxWidths []int
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
		m.rowsView.Width = int(float64(msg.Width) * TABLE_WIDTH_RATIO)
		m.rowsView.Height = msg.Height - 3 // HACK: topbar 1 + debug line 1 + header 1
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > 0 {
				m.cursor--
			} else {
				m.rowsView.LineUp(TABLE_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(m.rowsView.Height-1, len(m.objs)-1) {
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
		fmt.Sprintf("cursor: %d, objs: %d, yoffset: %d", m.cursor, len(m.objs), m.rowsView.YOffset),
	)
}

func (m *tableModel) renderHeader() string {
	headerStyle := lipgloss.NewStyle().Bold(true)
	var render strings.Builder
	// headers
	render.WriteString(m.cellStyle(0).Render("Name"))
	for i, node := range m.nodes {
		render.WriteString(m.cellStyle(i).Render(node.Name()))
	}

	return headerStyle.Render(render.String())
}

func (m *tableModel) renderRow() string {
	selectedLineStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.Mauve)
	var render strings.Builder

	// rows
	for i, obj := range m.objs {
		line := m.cellStyle(0).Render(displayName(obj))
		for j, node := range m.nodes {
			line += m.cellStyle(j).Render(m.val(node, obj))
		}
		if m.isCursor(i) {
			line = selectedLineStyle.Render(line)
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
	var result []int

	for _, node := range nodes {
		max := len(node.Name())
		for _, obj := range m.objs {
			if len(m.val(node, obj)) > max {
				max = len(m.val(node, obj))
			}
		}
		result = append(result, max)
	}

	m.nodeMaxWidths = result
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

func (m *tableModel) colMaxWidth(index int) int {
	if index == 0 {
		return m.nameMaxWidth
	}

	return m.nodeMaxWidths[index-1]
}
