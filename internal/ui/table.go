package ui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type tableModel struct {
	headers []string
	rows    [][]string
	cursor  int
	// vp      *viewport.Model
}

func newTableModel(headers []string, rows [][]string) *tableModel {
	return &tableModel{
		headers: headers,
		rows:    rows,
		cursor:  0,
	}
}

func (m *tableModel) Init() tea.Cmd {
	return nil
}

func (m *tableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// switch msg := msg.(type) {
	// case tea.KeyMsg:
	// 	// switch msg.String() {
	// 	// case "up", "down":
	// 	// 	m.cursor += 1
	// 	// }
	// }
	return m, nil
}

func (m *tableModel) View() string {
	var render strings.Builder
	render.WriteString(lipgloss.NewStyle().Render(strings.Join(m.headers, ",")))
	render.WriteString("\n")
	for _, row := range m.rows {
		line := strings.Join(row, ",") + "\n"
		render.WriteString(lipgloss.NewStyle().Render(line))
	}
	return render.String()
}
