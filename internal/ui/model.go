package ui

import tea "github.com/charmbracelet/bubbletea"

type mainModel struct {
	schema *schemaModel
}

func InitMainModel() *mainModel {
	return &mainModel{
		schema: InitModel(),
	}
}

func (m *mainModel) Init() tea.Cmd {
	return nil
}

func (m *mainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	sm, cmd := m.schema.Update(msg)
	m.schema = sm.(*schemaModel)
	return m, cmd
}

func (m *mainModel) View() string {
	return m.schema.View()
}
