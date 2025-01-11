package ui

import "github.com/charmbracelet/bubbles/key"

type keyMap struct {
	quit       key.Binding
	hideKbar   key.Binding
	toggleKbar key.Binding
	tabView    key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		quit:     key.NewBinding(key.WithKeys("ctrl+c")),
		hideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		toggleKbar: key.NewBinding(
			key.WithKeys("ctrl+k"),
			key.WithHelp("^+k", "kinds"),
		),
		tabView: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "switch schema/result"),
		),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.toggleKbar,
	}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}
