package ui

import (
	"log"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/sahilm/fuzzy"
)

const (
	KBAR_WIDTH                = 50
	SEARCH_RESULTS_MAX_HEIGHT = 10

	KBAR_SCROLL_STEP = 1
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
}

type searchResult struct {
	Item    kbarItem
	Hovered bool
}

type searchResults []searchResult

type kbarItems []kbarItem

func (i kbarItem) Render() string {
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

func (sr searchResult) Render() string {
	style := lipgloss.NewStyle()
	if sr.Hovered {
		style = style.Background(theme.Overlay0)
	}
	return style.Render(sr.Item.Render())
}

func (sr searchResults) String() string {
	noResultsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	if len(sr) == 0 {
		return noResultsStyle.Render("No results found.")
	}

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
	srViewport    viewport.Model
	cursor        int
}

func (m *kbarModel) Reset() {
	m.input.Reset()
	m.cursor = 0
	m.SetSearchResults(m.items)
	m.srViewport.SetYOffset(0)
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
			Border(lipgloss.ThickBorder()).
			Width(KBAR_WIDTH),
		items:      items,
		input:      ti,
		cursor:     0,
		srViewport: viewport.New(KBAR_WIDTH, SEARCH_RESULTS_MAX_HEIGHT),
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
	searchResult := strings.TrimSuffix(m.searchResults.String(), "\n")
	m.srViewport.SetContent(searchResult)
	return m.style.Render(
		lipgloss.JoinVertical(lipgloss.Left,
			inputStyle.Render(m.input.View()),
			m.srViewport.View(),
		),
	)
}

type selectGVKMsg struct {
	gvk schema.GroupVersionKind
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
			} else {
				m.srViewport.LineUp(KBAR_SCROLL_STEP)
			}
			m.SetSearchResults(filtered)
		case "down":
			if m.cursor < min(len(filtered)-1, SEARCH_RESULTS_MAX_HEIGHT-1) {
				m.MoveCursorDown(filtered)
			} else {
				m.srViewport.LineDown(KBAR_SCROLL_STEP)
			}
			m.SetSearchResults(filtered)
		case "enter":
			// filtered[m.cursor].Selected = true
			return m, func() tea.Msg {
				actualIndex := m.cursor + m.srViewport.YOffset
				return selectGVKMsg{gvk: filtered[actualIndex].GroupVersionKind}
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
			Hovered: m.cursor == index-m.srViewport.YOffset,
		})
	}
	m.searchResults = newSearchResults
}

func (m *kbarModel) MoveCursorTop(items kbarItems) {
	m.cursor = 0
	m.SetSearchResults(items)
}

func (m *kbarModel) MoveCursorUp(items kbarItems) {
	m.cursor--
}

func (m *kbarModel) MoveCursorDown(items kbarItems) {
	m.cursor++
}
