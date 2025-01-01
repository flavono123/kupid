// TODO: remove all keymap would go for each "handling"(case of switch key.Matches(msg, ...)) model's
package keymap

import "github.com/charmbracelet/bubbles/key"

// main
type KeyMap struct {
	Quit     key.Binding
	HideKbar key.Binding
	ShowKbar key.Binding
	TabView  key.Binding
}

func NewKeyMap() KeyMap {
	return KeyMap{
		Quit:     key.NewBinding(key.WithKeys("ctrl+c")),
		HideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		ShowKbar: key.NewBinding(
			key.WithKeys("alt+k"),
			key.WithHelp("alt(opt)+k", "kinds"),
		),
		TabView: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "switch schema/result"),
		),
	}
}

func (k KeyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.ShowKbar,
	}
}

func (k KeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}

// schema
type SchemaKeyMap struct {
	Up          key.Binding
	Down        key.Binding
	Action      key.Binding
	LevelExpand key.Binding
	AllExpand   key.Binding
}

func NewSchemaKeyMap() SchemaKeyMap {
	return SchemaKeyMap{
		Up:   key.NewBinding(key.WithKeys("up")),
		Down: key.NewBinding(key.WithKeys("down")),
		Action: key.NewBinding(
			key.WithKeys(" "),
			key.WithHelp("space", "fold/pick"),
		),
		LevelExpand: key.NewBinding(
			key.WithKeys("ctrl+@"),
			key.WithHelp("ctrl+space", "expand level"),
		),
		AllExpand: key.NewBinding(
			key.WithKeys("ctrl+a"),
			key.WithHelp("ctrl+a", "expand all"),
		),
	}
}

func (k SchemaKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.Action,
	}
}

func (k SchemaKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{}, // only render short help
	}
}

// kbar
type KbarKeyMap struct {
	Show key.Binding
	Hide key.Binding
}

func NewKbarKeyMap() KbarKeyMap {
	return KbarKeyMap{
		Show: key.NewBinding(key.WithKeys("alt+k")),
		Hide: key.NewBinding(key.WithKeys("esc", "alt+k")),
	}
}

// TODO: seperate to nested package, not only this but all submodels
// table
type TableKeyMap struct {
	Up   key.Binding
	Down key.Binding
}

func NewTableKeyMap() TableKeyMap {
	return TableKeyMap{
		Up:   key.NewBinding(key.WithKeys("up")),
		Down: key.NewBinding(key.WithKeys("down")),
	}
}
