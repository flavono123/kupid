package ui

import (
	"log"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"github.com/sahilm/fuzzy"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

type kbarModel struct {
	keys          kbarKeyMap
	visible       bool
	style         lipgloss.Style
	items         kbarItems
	input         textinput.Model
	searchResults searchResults
	srViewport    viewport.Model
	cursor        int
}

func newKbarModel() *kbarModel {
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
		keys:    newKbarKeyMap(),
		visible: false,
		style: lipgloss.NewStyle().
			Border(lipgloss.ThickBorder()).
			Width(KBAR_WIDTH),
		items:      items,
		input:      ti,
		cursor:     0,
		srViewport: viewport.New(KBAR_WIDTH, KBAR_SEARCH_RESULTS_MAX_HEIGHT),
	}

	m.setSearchResults(items)
	return m
}

func (m *kbarModel) Init() tea.Cmd {
	return tea.Batch(
		m.input.Focus(),
		textinput.Blink,
	)
}

func (m *kbarModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	prevInputValue := m.input.Value()
	m.input, cmd = m.input.Update(msg)
	filtered := m.items.filter(m.input.Value())
	if prevInputValue != m.input.Value() {
		m.moveCursorTop(filtered)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.visible {
			switch msg.String() {
			case "up":
				if m.cursor > 0 {
					m.moveCursorUp(filtered)
				} else {
					m.srViewport.LineUp(KBAR_SCROLL_STEP)
				}
				m.setSearchResults(filtered)
			case "down":
				if m.cursor < min(len(filtered)-1, KBAR_SEARCH_RESULTS_MAX_HEIGHT-1) {
					m.moveCursorDown(filtered)
				} else {
					m.srViewport.LineDown(KBAR_SCROLL_STEP)
				}
				m.setSearchResults(filtered)
			case "enter":
				return m, func() tea.Msg {
					actualIndex := m.cursor + m.srViewport.YOffset
					return selectGVKMsg{gvk: filtered[actualIndex].GroupVersionKind}
				}
			case "esc", "alt+k": // HACK: use keymap
				m.visible = false
				cmd = nil
			}
		} else {
			switch {
			case key.Matches(msg, m.keys.show):
				m.visible = true
				m.reset()

				cmd = tea.Batch(
					m.input.Focus(),
					textinput.Blink,
				)
			}
		}
	}

	return m, cmd
}

func (m *kbarModel) View() string {
	inputStyle := lipgloss.NewStyle().Margin(0, 0, 1, 0)
	searchResult := strings.TrimSuffix(m.searchResults.string(), "\n")
	m.srViewport.SetContent(searchResult)
	return m.style.Render(
		lipgloss.JoinVertical(lipgloss.Left,
			inputStyle.Render(m.input.View()),
			m.srViewport.View(),
		),
	)
}

// utils

func (m *kbarModel) reset() {
	m.input.Reset()
	m.cursor = 0
	m.setSearchResults(m.items)
	m.srViewport.SetYOffset(0)
}

func (m *kbarModel) setSearchResults(items kbarItems) {
	var newSearchResults searchResults
	for index, item := range items {
		newSearchResults = append(newSearchResults, searchResult{
			Item:    item,
			Hovered: m.cursor == index-m.srViewport.YOffset,
		})
	}
	m.searchResults = newSearchResults
}

func (m *kbarModel) moveCursorTop(items kbarItems) {
	m.cursor = 0
	// TODO: remove
	m.setSearchResults(items)
}

func (m *kbarModel) moveCursorUp(items kbarItems) {
	m.cursor--
}

func (m *kbarModel) moveCursorDown(items kbarItems) {
	m.cursor++
}

func (m *kbarModel) actualItemIndex() int {
	return m.cursor + m.srViewport.YOffset
}

// subcomponents(not model)
type kbarItem struct {
	schema.GroupVersionKind
}
type kbarItems []kbarItem

type searchResult struct {
	Item    kbarItem
	Hovered bool
}

type searchResults []searchResult

func (i kbarItem) render() string {
	l := lipgloss.NewStyle().
		MaxWidth(KBAR_WIDTH).
		Padding(0, 0, 0, 1)
	g := lipgloss.NewStyle().Foreground(theme.Subtext1)
	s := lipgloss.JoinHorizontal(
		lipgloss.Left,
		i.Kind,
		" ",
		g.Render(i.Group),
	)

	return l.Render(s)
}

func (m kbarItems) filter(inputValue string) kbarItems {
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

func (sr searchResult) render() string {
	style := lipgloss.NewStyle()
	if sr.Hovered {
		style = style.Background(theme.Overlay0)
	}
	return style.Render(sr.Item.render())
}

func (sr searchResults) string() string {
	noResultsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	if len(sr) == 0 {
		return noResultsStyle.Render("No results found.")
	}

	var result []string
	for _, item := range sr {
		result = append(result, item.render())
	}

	return strings.Join(result, "\n")
}
