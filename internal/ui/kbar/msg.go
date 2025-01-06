package kbar

import tea "github.com/charmbracelet/bubbletea"

type ShowMsg struct{}

type HideMsg struct{}

func Show() tea.Msg {
	return ShowMsg{}
}

func Hide() tea.Msg {
	return HideMsg{}
}
