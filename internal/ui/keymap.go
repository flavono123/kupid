package ui

import "github.com/charmbracelet/bubbles/key"

// main
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

// schema
type schemaKeyMap struct {
	up          key.Binding
	down        key.Binding
	action      key.Binding
	levelExpand key.Binding
}

func newSchemaKeyMap() schemaKeyMap {
	return schemaKeyMap{
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
	}
}

func (k schemaKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.action,
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
