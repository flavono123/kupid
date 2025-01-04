package kbar

import "github.com/charmbracelet/bubbles/key"

type keyMap struct {
	show key.Binding
	hide key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		show: key.NewBinding(key.WithKeys("alt+k")),
		hide: key.NewBinding(key.WithKeys("esc", "alt+k")),
	}
}
