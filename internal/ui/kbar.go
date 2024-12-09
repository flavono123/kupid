package ui

import (
	"fmt"
	"log"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
	schema.GroupVersionKind

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
	noResultsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	if len(sr) == 0 {
		return noResultsStyle.Render("No results found.")
	}

	var result []string
	for _, item := range sr {
		result = append(result, item.Render())
	}

	// cut max 10 items
	// TODO: set max height and scroll
	if len(result) > 10 {
		result = result[:10]
		result = append(result, "more gvks ...")
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

func (m *kbarModel) Reset() {
	m.input.Reset()
	m.cursor = 0
	m.SetSearchResults(m.items)
}

func NewKbarModel() *kbarModel {
	var items kbarItems

	gvks, err := kube.GetGVKs()
	if err != nil {
		log.Fatalf("failed to get gvks: %v", err)
	}
	for _, gvk := range gvks {
		items = append(items, kbarItem{GroupVersionKind: gvk})
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
			Width(modalWidth),
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
	inputStyle := lipgloss.NewStyle().Margin(0, 0, 1, 0)
	return m.style.Render(
		lipgloss.JoinVertical(lipgloss.Left,
			inputStyle.Render(m.input.View()),
			m.searchResults.View(),
		),
	)
}

func (m *kbarModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	prevInputValue := m.input.Value()
	m.input, cmd = m.input.Update(msg)
	filtered := m.items.Filter(m.input.Value())
	if prevInputValue != m.input.Value() {
		m.MoveCursorTop(filtered)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up":
			if m.cursor > 0 {
				m.MoveCursorUp(filtered)
			}
		case "down":
			if m.cursor < len(filtered)-1 {
				m.MoveCursorDown(filtered)
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

func (m *kbarModel) MoveCursorTop(items kbarItems) {
	m.cursor = 0
	m.SetSearchResults(items)
}

func (m *kbarModel) MoveCursorUp(items kbarItems) {
	if m.cursor == 0 {
		return
	}

	m.cursor -= 1
	m.SetSearchResults(items)
}

func (m *kbarModel) MoveCursorDown(items kbarItems) {
	if m.cursor == len(items)-1 {
		return
	}

	m.cursor += 1
	m.SetSearchResults(items)
}
