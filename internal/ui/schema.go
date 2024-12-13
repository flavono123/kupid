package ui

import (
	"fmt"
	"log"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

const (
	START_INDENT    = 0
	VIEWPORT_WIDTH  = 80
	VIEWPORT_HEIGHT = 20
	LINE_ELLIPSIS   = "..."
	CURSOR_TOP      = 0
	CURSOR_BOTTOM   = VIEWPORT_HEIGHT - 1
	SCROLL_STEP     = 1
)

type schemaModel struct {
	fields    map[string]*kube.Field
	viewport  viewport.Model
	style     lipgloss.Style
	cursor    int
	curLineNo int
	curField  *kube.Field
	curGVK    schema.GroupVersionKind

	keys keyMap
	help help.Model

	kbarModel *kbarModel
	showKbar  bool
}

type keyMap struct {
	up         key.Binding
	down       key.Binding
	hideKbar   key.Binding
	showKbar   key.Binding
	toggleReq  key.Binding
	toggleFold key.Binding
	quit       key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{
		k.showKbar,
		k.toggleReq,
		k.toggleFold,
	}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{},
	}
}

func InitModel() *schemaModel {
	keys := keyMap{
		up:       key.NewBinding(key.WithKeys("up")),
		down:     key.NewBinding(key.WithKeys("down")),
		hideKbar: key.NewBinding(key.WithKeys("esc", "alt+k")),
		quit:     key.NewBinding(key.WithKeys("ctrl+c")),
		showKbar: key.NewBinding(
			key.WithKeys("alt+k"),
			key.WithHelp("alt+k", "kinds"),
		),
		toggleReq: key.NewBinding( // TODO: implement
			key.WithKeys("ctrl+r"),
			key.WithHelp("ctrl+r", "required only"),
		),
		toggleFold: key.NewBinding(
			key.WithKeys(" "),
			key.WithHelp("space", "(un)fold"),
		),
	}

	gvk := schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "Pod",
	}

	fields, err := kube.CreateFieldTree(gvk)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("white"))

	vp := viewport.New(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	m := &schemaModel{
		fields:    fields,
		viewport:  vp,
		style:     style,
		cursor:    0,
		kbarModel: NewKbarModel(),
		curGVK:    gvk,
		keys:      keys,
		help:      help.New(),
	}
	content := m.renderRecursive(m.fields)
	content = strings.TrimSuffix(content, "\n")
	vp.SetContent(content)

	return m
}

func (m *schemaModel) Init() tea.Cmd {
	return nil
}

func (m *schemaModel) IsCursor() bool {
	return m.curLineNo-m.viewport.YOffset == m.cursor
}

func (m *schemaModel) ToggleFolder() {
	if m.curField != nil && m.curField.Foldable() {
		m.curField.Expanded = !m.curField.Expanded
	}
}

func (m *schemaModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if key.Matches(msg, m.keys.quit) {
			return m, tea.Quit
		}

		if m.showKbar {
			var cmd tea.Cmd
			var model tea.Model
			model, cmd = m.kbarModel.Update(msg)
			m.kbarModel = model.(*kbarModel)
			switch {
			case key.Matches(msg, m.keys.hideKbar):
				m.showKbar = false
			}
			return m, cmd
		}

		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > CURSOR_TOP {
				m.cursor--
			} else {
				m.viewport.LineUp(SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(CURSOR_BOTTOM, m.curLineNo-1) {
				m.cursor++
			} else {
				m.viewport.LineDown(SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.toggleFold):
			m.ToggleFolder()
		case key.Matches(msg, m.keys.showKbar):
			m.showKbar = !m.showKbar
			m.kbarModel.Reset()
			return m, tea.Batch(
				m.kbarModel.input.Focus(),
				textinput.Blink, // FIXME: not blinking
			)
		}
		return m, nil

	case selectGVKMsg:
		m.curGVK = msg.gvk
		var err error
		m.fields, err = kube.CreateFieldTree(msg.gvk)
		if err != nil {
			log.Fatalf("failed to create field tree: %v", err)
		}

		m.cursor = 0
		m.kbarModel.Reset()
		m.showKbar = false
	}
	return m, nil
}

func (m *schemaModel) View() string {
	m.curLineNo = 0 // to avoid accumulating line number infinitely
	content := m.renderRecursive(m.fields)
	content = strings.TrimSuffix(content, "\n")
	m.viewport.SetContent(content)

	if m.showKbar {
		return lipgloss.Place(
			VIEWPORT_WIDTH,
			VIEWPORT_HEIGHT,
			lipgloss.Center,
			lipgloss.Center,
			m.kbarModel.View(),
			lipgloss.WithWhitespaceBackground(theme.Mantle),
		)
	}

	topBarStyle := lipgloss.NewStyle().
		Foreground(theme.Blue).
		Padding(0, 0, 0, 1)

	return lipgloss.JoinVertical(lipgloss.Left,
		topBarStyle.Render(m.curGVK.Kind),
		m.style.Render(m.viewport.View()),
		m.help.View(m.keys),
	)
}

func (m *schemaModel) renderRecursive(fields map[string]*kube.Field) string {
	var result strings.Builder
	keys := []string{}
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		if key == "apiVersion" || key == "kind" || key == "metadata" {
			continue
		}
		field := fields[key]

		indent := strings.Repeat(" ", field.Level*2)
		var cursorStr string
		cursor := lipgloss.NewStyle().Foreground(theme.Text)
		if m.IsCursor() {
			cursorStr = ">"
			m.curField = field
		} else {
			cursorStr = " "
		}
		folder := lipgloss.NewStyle().Foreground(theme.Subtext1)
		var foldStr string
		if field.Foldable() {
			if field.Expanded {
				foldStr = "-"
			} else {
				foldStr = "+"
			}
		} else {
			foldStr = " "
		}
		line := lipgloss.NewStyle().MaxWidth(VIEWPORT_WIDTH)

		result.WriteString(line.Render(lipgloss.JoinHorizontal(
			lipgloss.Left,
			indent,
			cursor.Render(cursorStr),
			folder.Render(foldStr),
			renderField(field),
		)) + "\n")
		m.curLineNo++

		if field.Children != nil && field.Expanded {
			result.WriteString(m.renderRecursive(field.Children))
		}
	}

	return result.String()
}

func renderField(field *kube.Field) string {
	n := lipgloss.NewStyle().Foreground(theme.Green)
	t := lipgloss.NewStyle().Foreground(theme.Peach)
	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		n.Render(field.Name),
		t.Render(fmt.Sprintf("<%s>", field.Type)),
	)
}
