package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/ui/theme"
)

type tableModel struct {
	// msg
	keys   tableKeyMap
	cursor int

	// view
	headers     []string
	rows        [][]string
	rowsView    viewport.Model
	maxRowWidth int
}

func newTableModel(headers []string, rows [][]string) *tableModel {
	return &tableModel{
		keys:        newTableKeyMap(),
		cursor:      0,
		headers:     headers,
		rows:        rows,
		rowsView:    viewport.New(0, 0),
		maxRowWidth: maxRowWidth(headers, rows),
	}
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
		fmt.Sprintf("cursor: %d", m.cursor),
	)
}

func (m *tableModel) renderHeader() string {
	headerStyle := lipgloss.NewStyle().Bold(true).Width(m.maxRowWidth)
	var render strings.Builder
	// headers
	render.WriteString(lipgloss.NewStyle().Render(strings.Join(m.headers, ",")))

	return headerStyle.Render(render.String())
}

func (m *tableModel) renderRow() string {
	selectedLineStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.Mauve)
	var render strings.Builder

	// rows
	for i, row := range m.rows {
		line := strings.Join(row, ",")
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

func maxColumnWidths(headers []string, rows [][]string) []int {
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

	return result
}

// TODO: render for each column
func maxRowWidth(headers []string, rows [][]string) int {
	colWidths := maxColumnWidths(headers, rows)
	sum := 0
	for _, width := range colWidths {
		sum += width
	}
	return sum
}

// func (m *resultModel) val(node *Node, obj *unstructured.Unstructured) string {
// 	// TODO: treat deep pick for map[string]interface{}, array fields
// 	// TODO: map[string]interface{}: create children field(ui only) with unique set of resources' keys
// 	// TODO: array: create children field(ui only) with max length of resources' values
// 	// TODO: inject key or index among of path
// 	val, found, err := GetNestedValueWithIndex(obj.Object, node.NodeFullPath()...)
// 	if err != nil || !found {
// 		return "-"
// 	}

// 	if str, ok := val.(string); ok && len(str) == 0 { // edge case `""`
// 		return "\"\""
// 	}

// 	return fmt.Sprintf("%v", val)
// }
