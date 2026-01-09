package kbar

import (
	"log"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sahilm/fuzzy"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/flavono123/kattle/internal/kube"
	"github.com/flavono123/kattle/internal/ui/event"
	"github.com/flavono123/kattle/internal/ui/theme"
)

const (
	KBAR_WIDTH_DIV                 = 3
	KBAR_SEARCH_RESULTS_MAX_HEIGHT = 10

	KBAR_SCROLL_STEP = 1
)

type Model struct {
	keys          keyMap
	visible       bool
	style         lipgloss.Style
	items         kbarItems
	input         textinput.Model
	searchResults searchResults
	srViewport    viewport.Model
	cursor        int
}

func NewModel() *Model {
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
	m := &Model{
		keys:    newKeyMap(),
		visible: false,
		style: lipgloss.NewStyle().
			Border(lipgloss.ThickBorder()),
		items:      items,
		input:      ti,
		cursor:     0,
		srViewport: viewport.New(0, 0),
	}

	m.setSearchResults(items)
	return m
}

func (m *Model) Init() tea.Cmd {
	return textinput.Blink
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	prevInputValue := m.input.Value()

	im, iCmd := m.input.Update(msg)
	m.input = im
	cmds = append(cmds, iCmd)
	filtered := m.items.filter(m.input.Value())
	if prevInputValue != m.input.Value() {
		m.moveCursorTop(filtered)
	}

	switch msg := msg.(type) {
	case ShowMsg:
		m.setVisible(true)
		m.reset()

		cmds = append(cmds, m.input.Focus())
	case HideMsg:
		m.setVisible(false)
		m.reset()
		m.input.Blur()

	case tea.WindowSizeMsg:
		m.setViewSize(msg)
	case tea.KeyMsg:
		if m.Visible() {
			switch {
			case key.Matches(msg, m.keys.up):
				if m.cursor > 0 {
					m.cursor--
				} else {
					m.srViewport.ScrollUp(KBAR_SCROLL_STEP)
				}
				m.setSearchResults(filtered)
			case key.Matches(msg, m.keys.down):
				if m.cursor < min(len(filtered)-1, KBAR_SEARCH_RESULTS_MAX_HEIGHT-1) {
					m.cursor++
				} else {
					m.srViewport.ScrollDown(KBAR_SCROLL_STEP)
				}
				m.setSearchResults(filtered)
			case key.Matches(msg, m.keys.pick):
				actualIndex := m.cursor + m.srViewport.YOffset
				cmds = append(cmds, func() tea.Msg {
					return event.PickGVKMsg{GVK: filtered[actualIndex].GroupVersionKind}
				})
			case key.Matches(msg, m.keys.hide): // Additional key to hide kbar when only kbar is showing
				cmds = append(cmds, Hide())
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) View() string {
	inputStyle := lipgloss.NewStyle().Margin(0, 0, 1, 0)
	searchResult := strings.TrimSuffix(m.searchResults.string(m.srViewport.Width), "\n")
	m.srViewport.SetContent(searchResult)
	return m.style.Render(
		lipgloss.JoinVertical(lipgloss.Left,
			inputStyle.Render(m.input.View()),
			m.srViewport.View(),
		),
	)
}

func (m *Model) setVisible(visible bool) {
	m.visible = visible
}

func (m *Model) Visible() bool {
	return m.visible
}

func (m *Model) setViewSize(msg tea.WindowSizeMsg) {
	m.srViewport.Width = msg.Width / KBAR_WIDTH_DIV
	m.srViewport.Height = KBAR_SEARCH_RESULTS_MAX_HEIGHT
}

func (m *Model) reset() {
	m.input.Reset()
	m.cursor = 0
	m.setSearchResults(m.items)
	m.srViewport.SetYOffset(0)
}

func (m *Model) setSearchResults(items kbarItems) {
	var newSearchResults searchResults
	for index, item := range items {
		newSearchResults = append(newSearchResults, searchResult{
			Item:    item,
			Hovered: m.cursor == index-m.srViewport.YOffset,
		})
	}
	m.searchResults = newSearchResults
}

func (m *Model) moveCursorTop(items kbarItems) {
	m.cursor = 0
	m.setSearchResults(items)
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

func (i kbarItem) render(width int) string {
	l := lipgloss.NewStyle().
		MaxWidth(width).
		Padding(0, 0, 0, 1)
	g := lipgloss.NewStyle().Foreground(theme.Subtext1())
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

func (sr searchResult) render(width int) string {
	style := lipgloss.NewStyle()
	if sr.Hovered {
		style = style.Background(theme.Overlay0())
	}
	return style.Render(sr.Item.render(width))
}

func (sr searchResults) string(width int) string {
	noResultsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	if len(sr) == 0 {
		return noResultsStyle.Render("No results found.")
	}

	var result []string
	for _, item := range sr {
		result = append(result, item.render(width))
	}

	return strings.Join(result, "\n")
}
