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
	"secret",
	"configmap",
	"hpa",
	"ingress",
	"service",
	"nodepool",
	"ec2nodeclass",
}

type kbarItem struct {
	Group   string
	Kind    string
	Version string

	Selected bool
}

type searchResult struct {
	Item    kbarItem
	Hovered bool
}

type searchResults []searchResult

type kbarItems []kbarItem

func (i kbarItem) String() string {
	return fmt.Sprintf("%s %s %s", i.Group, i.Kind, i.Version)
}

func (sr searchResult) Render() string {
	style := lipgloss.NewStyle()
	if sr.Hovered {
		style = style.Background(lipgloss.Color("236"))
	}
	return style.Render(sr.Item.String())
}

func (sr searchResults) View() string {
	var result []string
	for _, item := range sr {
		result = append(result, item.Render())
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
	style         lipgloss.Style
	items         kbarItems
	input         textinput.Model
	searchResults searchResults
	cursor        int
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
		items:  items,
		input:  ti,
		cursor: 0,
	}

	m.SetSearchResults(items)
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
		m.searchResults.View(),
	)
}

func (m *kbarModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	prevInputValue := m.input.Value()
	m.input, cmd = m.input.Update(msg)
	filtered := m.items.Filter(m.input.Value())
	if prevInputValue != m.input.Value() {
		m.MoveTop(filtered)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up":
			if m.cursor > 0 {
				m.MoveUp(filtered)
			}
		case "down":
			if m.cursor < len(filtered)-1 {
				m.MoveDown(filtered)
			}
		}
	}

	return m, cmd
}

func (m *kbarModel) SetSearchResults(items kbarItems) {
	var newSearchResults searchResults
	for index, item := range items {
		newSearchResults = append(newSearchResults, searchResult{
			Item:    item,
			Hovered: m.cursor == index,
		})
	}
	m.searchResults = newSearchResults
}

func (m *kbarModel) MoveTop(items kbarItems) {
	m.cursor = 0
	m.SetSearchResults(items)
}

func (m *kbarModel) MoveUp(items kbarItems) {
	if m.cursor == 0 {
		return
	}

	m.cursor -= 1
	m.SetSearchResults(items)
}

func (m *kbarModel) MoveDown(items kbarItems) {
	if m.cursor == len(items)-1 {
		return
	}

	m.cursor += 1
	m.SetSearchResults(items)
}
