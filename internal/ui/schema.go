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
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

type schemaModel struct {
	fields map[string]*kube.Field
	vp     viewport.Model
	width  int
	height int

	style     lipgloss.Style
	cursor    int
	curLineNo int
	curField  *kube.Field
	curGVK    schema.GroupVersionKind

	keys schemaKeyMap
	help help.Model
}

func InitModel(gvk schema.GroupVersionKind) *schemaModel {
	fields, err := kube.CreateFieldTree(gvk)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.Overlay0)

	hMargin, vMargin := style.GetFrameSize()
	width := SCHEMA_WIDTH - hMargin
	height := SCHEMA_HEIGHT - vMargin
	vp := viewport.New(width, height)
	m := &schemaModel{
		fields: fields,
		vp:     vp,
		width:  width,
		height: height,
		style:  style,
		cursor: 0,
		curGVK: gvk,
		keys:   newSchemaKeyMap(),
		help:   help.New(),
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
	return m.curLineNo-m.vp.YOffset == m.cursor
}

func (m *schemaModel) ToggleFolder() {
	if m.curField != nil && m.curField.Foldable() {
		m.curField.Expanded = !m.curField.Expanded
	}
}

type pickFieldMsg struct {
	field kube.Field
}

type unpickFieldMsg struct {
	field kube.Field
}

func (m *schemaModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var retCmd tea.Cmd
	retCmd = nil

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > SCHEMA_CURSOR_TOP {
				m.cursor--
			} else {
				m.vp.LineUp(SCHEMA_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(SCHEMA_CURSOR_BOTTOM, m.curLineNo-1) {
				m.cursor++
			} else {
				m.vp.LineDown(SCHEMA_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.action):
			if m.curField == nil {
				break
			}

			if m.curField.Foldable() {
				m.ToggleFolder()
			} else { // selectable, for leaf fields
				if m.curField.Selected {
					m.curField.Selected = false
					retCmd = func() tea.Msg {
						return unpickFieldMsg{field: *m.curField}
					}
				} else {
					m.curField.Selected = true
					retCmd = func() tea.Msg {
						return pickFieldMsg{field: *m.curField}
					}
				}
			}
		case key.Matches(msg, m.keys.quit):
			return m, tea.Quit
		}
	}

	return m, retCmd
}

func (m *schemaModel) View() string {
	m.curLineNo = 0 // to avoid accumulating line number infinitely
	content := m.renderRecursive(m.fields)
	content = strings.TrimSuffix(content, "\n")
	m.vp.SetContent(content)

	ctx, err := kube.CurrentContext()
	if err != nil {
		log.Fatalf("failed to get current context: %v", err)
	}
	kind := lipgloss.NewStyle().Foreground(theme.Blue).Render(m.curGVK.Kind)
	topbar := lipgloss.JoinHorizontal(lipgloss.Left,
		ctx,
		" ",
		kind,
	)
	return lipgloss.JoinVertical(lipgloss.Left,
		topbar,
		m.style.Render(m.vp.View()),
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
		} else { // selectable
			if field.Selected {
				foldStr = "◉"
			} else {
				foldStr = "○"
			}
		}
		line := lipgloss.NewStyle().MaxWidth(m.width)

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

func (m *schemaModel) Reset(gvk schema.GroupVersionKind) {
	m.curGVK = gvk // TODO: check if this is necessary
	fields, err := kube.CreateFieldTree(m.curGVK)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	m.fields = fields
	m.cursor = 0
	// m.curLineNo = 0
	// m.curField = nil
}
