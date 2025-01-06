package kbar

import "github.com/charmbracelet/bubbles/key"

type keyMap struct {
	up   key.Binding
	down key.Binding
	pick key.Binding
	hide key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		up:   key.NewBinding(key.WithKeys("up")),
		down: key.NewBinding(key.WithKeys("down")),
		pick: key.NewBinding(key.WithKeys("enter")),
		hide: key.NewBinding(key.WithKeys("esc")),
	}
}
