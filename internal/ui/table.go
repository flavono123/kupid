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
	headers   []string
	rows      [][]string
	rowsView  viewport.Model
	colWidths []int
}

func newTableModel(headers []string, rows [][]string) *tableModel {
	m := &tableModel{
		keys:     newTableKeyMap(),
		cursor:   0,
		headers:  headers,
		rows:     rows,
		rowsView: viewport.New(0, 0),
	}
	m.setColumnWidths(headers, rows)
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
			if m.cursor < min(m.rowsView.Height-1, len(m.rows)-1) {
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
		fmt.Sprintf("cursor: %d, rows: %d, yoffset: %d", m.cursor, len(m.rows), m.rowsView.YOffset),
	)
}

func (m *tableModel) renderHeader() string {
	headerStyle := lipgloss.NewStyle().Bold(true)
	var render strings.Builder
	// headers
	for i, header := range m.headers {
		render.WriteString(m.cellStyle(i).Render(header))
	}

	return headerStyle.Render(render.String())
}

func (m *tableModel) renderRow() string {
	selectedLineStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.Mauve)
	var render strings.Builder

	// rows
	for i, row := range m.rows {
		line := ""
		for j, cell := range row {
			line += m.cellStyle(j).Render(cell)
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

func (m *tableModel) setColumnWidths(headers []string, rows [][]string) {
	var result []int

	for col, header := range headers {
		max := len(header)
		for _, row := range rows {
			if len(row[col]) > max {
				max = len(row[col])
			}
		}
		result = append(result, max)
	}

	m.colWidths = result
}

func (m *tableModel) setHeaders(nodes []*Node) {
	m.headers = []string{
		"Name",
	}
	for _, node := range nodes {
		m.headers = append(m.headers, node.Name())
	}
}

func (m *tableModel) setRows(nodes []*Node, objs []*unstructured.Unstructured) {
	m.rows = [][]string{}
	for _, obj := range objs {
		row := []string{
			displayName(obj),
		}
		for _, node := range nodes {
			row = append(row, m.val(node, obj))
		}
		m.rows = append(m.rows, row)
	}
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
	return lipgloss.NewStyle().Margin(0, 1).Width(m.colWidths[col])
}
