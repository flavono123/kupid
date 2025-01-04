package nav

import "github.com/charmbracelet/bubbles/key"

// Keymaps
type keyMap struct {
	up          key.Binding
	down        key.Binding
	action      key.Binding
	levelExpand key.Binding
	allExpand   key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		up:   key.NewBinding(key.WithKeys("up")),
		down: key.NewBinding(key.WithKeys("down")),
		action: key.NewBinding(
			key.WithKeys(" "),
			key.WithHelp("space", "fold/pick"),
		),
		levelExpand: key.NewBinding(
			key.WithKeys("ctrl+@"),
			key.WithHelp("ctrl+space", "expand level"),
		),
		allExpand: key.NewBinding(
			key.WithKeys("ctrl+a"),
			key.WithHelp("ctrl+a", "expand all"),
		),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.action,
	}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}
