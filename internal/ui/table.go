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
	headers []string
	rows    [][]string
	vp      viewport.Model
}

func newTableModel(headers []string, rows [][]string) *tableModel {
	m := &tableModel{
		keys:    newTableKeyMap(),
		cursor:  0,
		headers: headers,
		rows:    rows,
		vp:      viewport.New(0, 0),
	}
	content := m.render()
	m.vp.SetContent(content)
	return m
}

func (m *tableModel) Init() tea.Cmd {
	return nil
}

func (m *tableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.vp.Width = int(float64(msg.Width) * TABLE_WIDTH_RATIO)
		m.vp.Height = msg.Height - 2 // HACK: topbar 1 + debug line 1
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > 0 {
				m.cursor--
			} else {
				m.vp.LineUp(TABLE_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(m.vp.Height-2, len(m.rows)-1) { // HACK: index 1 + header 1(BUG)
				m.cursor++
			} else {
				m.vp.LineDown(TABLE_SCROLL_STEP)
			}
		}
	}
	return m, cmd
}

func (m *tableModel) View() string {
	content := m.render()
	m.vp.SetContent(content)
	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.vp.View(),
		fmt.Sprintf("cursor: %d", m.cursor),
	)
}

func (m *tableModel) render() string {
	selectedLineStyle := lipgloss.NewStyle().Foreground(theme.Mauve)
	var render strings.Builder
	// headers
	render.WriteString(lipgloss.NewStyle().Render(strings.Join(m.headers, ",")))
	render.WriteString("\n")

	// rows
	for i, row := range m.rows {
		line := strings.Join(row, ",")
		if i == m.cursor+m.vp.YOffset {
			line = selectedLineStyle.Render(line)
		}
		render.WriteString(line)
		render.WriteString("\n")
	}

	return render.String()
}
