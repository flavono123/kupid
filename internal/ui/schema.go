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

const (
	SCHEMA_WIDTH         = 80
	SCHEMA_HEIGHT        = 20
	SCHEMA_CURSOR_TOP    = 0
	SCHEMA_CURSOR_BOTTOM = SCHEMA_HEIGHT - 1
	SCHEMA_SCROLL_STEP   = 1
)

type schemaModel struct {
	fields    map[string]*kube.Field
	viewport  viewport.Model
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

	vp := viewport.New(SCHEMA_WIDTH, SCHEMA_HEIGHT)
	m := &schemaModel{
		fields:   fields,
		viewport: vp,
		style:    style,
		cursor:   0,
		curGVK:   gvk,
		keys:     newSchemaKeyMap(),
		help:     help.New(),
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
		switch {
		case key.Matches(msg, m.keys.up):
			if m.cursor > SCHEMA_CURSOR_TOP {
				m.cursor--
			} else {
				m.viewport.LineUp(SCHEMA_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.cursor < min(SCHEMA_CURSOR_BOTTOM, m.curLineNo-1) {
				m.cursor++
			} else {
				m.viewport.LineDown(SCHEMA_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.toggleFold):
			m.ToggleFolder()
		case key.Matches(msg, m.keys.quit):
			return m, tea.Quit
		}
	}

	return m, nil
}

func (m *schemaModel) View() string {
	m.curLineNo = 0 // to avoid accumulating line number infinitely
	content := m.renderRecursive(m.fields)
	content = strings.TrimSuffix(content, "\n")
	m.viewport.SetContent(content)

	ctx, err := kube.CurrentContext()
	if err != nil {
		log.Fatalf("failed to get current context: %v", err)
	}
	return lipgloss.JoinVertical(lipgloss.Left,
		ctx,
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
		line := lipgloss.NewStyle().MaxWidth(SCHEMA_WIDTH)

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
