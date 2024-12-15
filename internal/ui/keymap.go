package ui

import "github.com/charmbracelet/bubbles/key"

// main
type keyMap struct {
	hideKbar key.Binding
	showKbar key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		hideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		showKbar: key.NewBinding(
			key.WithKeys("alt+k"),
			key.WithHelp("alt(opt)+k", "kinds"),
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

// schema
type schemaKeyMap struct {
	up         key.Binding
	down       key.Binding
	toggleReq  key.Binding
	toggleFold key.Binding
	quit       key.Binding
}

func newSchemaKeyMap() schemaKeyMap {
	return schemaKeyMap{
		up:   key.NewBinding(key.WithKeys("up")),
		down: key.NewBinding(key.WithKeys("down")),
		quit: key.NewBinding(key.WithKeys("ctrl+c")),
		toggleFold: key.NewBinding(
			key.WithKeys(" "),
			key.WithHelp("space", "(un)fold"),
		),
	}
}

func (k schemaKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.toggleReq,
		k.toggleFold,
	}
}

func (k schemaKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}

// kbar
type kbarKeyMap struct {
	show key.Binding
	hide key.Binding
}

func newKbarKeyMap() kbarKeyMap {
	return kbarKeyMap{
		show: key.NewBinding(key.WithKeys("alt+k")),
		hide: key.NewBinding(key.WithKeys("esc", "alt+k")),
	}
}
