package table

import "github.com/charmbracelet/bubbles/key"

type keyMap struct {
	up   key.Binding
	down key.Binding
}

func newKeyMap() keyMap {
	return keyMap{
		up:   key.NewBinding(key.WithKeys("up")),
		down: key.NewBinding(key.WithKeys("down")),
	}
}
