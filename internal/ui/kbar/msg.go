package kbar

import (
	tea "github.com/charmbracelet/bubbletea"

	"github.com/flavono123/kupid/internal/ui/event"
)

type ShowMsg struct{}

type HideMsg struct{}

func Show() tea.Msg {
	return ShowMsg{}
}

func Hide() tea.Cmd {
	return tea.Sequence(
		func() tea.Msg {
			return HideMsg{}
		},
		func() tea.Msg {
			return event.RestoreLastSessionMsg{}
		},
	)
}
