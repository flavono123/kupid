package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sahilm/fuzzy"
)

const (
	modalWidth  = 50
	modalHeight = 10
)

var kinds = []string{
	"pod",
	"deployment",
	"service",
	"secret",
	"configmap",
	"hpa",
	"ingress",
	"service",
}

type kbarItem struct {
	Group   string
	Kind    string
	Version string

	Selected bool
	Hovered  bool
}

type kbarItems []kbarItem

func (i kbarItem) String() string {
	return fmt.Sprintf("%s %s %s", i.Group, i.Kind, i.Version)
}

func (m kbarItems) View(inputValue string) string {
	var result []string
	filtered := m.Filter(inputValue)
	for _, item := range filtered {
		result = append(result, item.String())
	}

	return strings.Join(result, "\n")
}

func (m kbarItems) Filter(inputValue string) kbarItems {
	if inputValue == "" {
		return m
	}

	var items kbarItems
	var itemStrings []string
	for _, item := range m {
		itemStrings = append(itemStrings, item.String())
	}
	matches := fuzzy.Find(inputValue, itemStrings)
	for _, match := range matches {
		items = append(items, m[match.Index])
	}
	return items
}

type kbarModel struct {
	style lipgloss.Style
	items kbarItems
	input textinput.Model
}

func (m *kbarModel) ResetInput() {
	m.input.Reset()
}

func NewKbarModel() *kbarModel {
	var items kbarItems
	for _, kind := range kinds {
		items = append(items, kbarItem{Kind: kind})
	}

	ti := textinput.New()
	ti.Placeholder = "Search or jump to..."
	ti.Focus()
	ti.SetCursor(0)
	ti.Prompt = "🔍 "
	ti.Width = 30
	ti.Cursor.Blink = true
	m := &kbarModel{
		style: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			Padding(1, 0).
			Width(modalWidth).Align(lipgloss.Center),
		items: items,
		input: ti,
	}

	return m
}

func (m *kbarModel) Init() tea.Cmd {
	return tea.Batch(
		m.input.Focus(),
		textinput.Blink, // FIXME: not blinking
	)
}

func (m *kbarModel) View() string {
	return lipgloss.JoinVertical(lipgloss.Left,
		m.input.View(),
		m.items.View(m.input.Value()),
	)
}

func (m *kbarModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	m.input, cmd = m.input.Update(msg)
	if cmd != nil {
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}
