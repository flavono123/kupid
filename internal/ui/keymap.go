package ui

import "github.com/charmbracelet/bubbles/key"

type keyMap struct {
	quit     key.Binding
	hideKbar key.Binding
	showKbar key.Binding
	tabView  key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		quit:     key.NewBinding(key.WithKeys("ctrl+c")),
		hideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		showKbar: key.NewBinding(
			key.WithKeys("alt+k"),
			key.WithHelp("alt(opt)+k", "kinds"),
		),
		tabView: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "switch schema/result"),
		),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.showKbar,
	}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}
