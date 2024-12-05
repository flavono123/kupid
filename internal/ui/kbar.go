package ui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	modalWidth  = 50
	modalHeight = 10
)

type kbarModel struct {
	content string
	style   lipgloss.Style
}

func NewKbarModel() *kbarModel {
	return &kbarModel{
		content: "Command palette",
		style: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			Padding(1, 0).
			Width(modalWidth).Align(lipgloss.Center),
	}
}

func (m *kbarModel) Init() tea.Cmd {
	return nil
}

func (m *kbarModel) View() string {
	return m.style.Render(m.content)
}

func (m *kbarModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	return m, nil
}
