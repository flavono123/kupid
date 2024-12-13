package ui

import (
	"fmt"
	"log"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/runtime/schema"

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

	kbarModel *kbarModel
	showKbar  bool
}

func NewSchemaModel() *schemaModel {
	gvk := schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "Pod",
	}
	gvr := schema.GroupVersionResource{
		Group:    gvk.Group,
		Version:  gvk.Version,
		Resource: "pods",
	}

	document, err := kube.GetDocument(gvr)
	if err != nil {
		log.Fatalf("failed to get document: %v", err)
	}
	schema, err := kube.FindSchemaByGVK(document, gvk)
	if err != nil {
		log.Fatalf("failed to find schema: %v", err)
	}
	fields, err := kube.CreateFieldTree(schema, document, make(map[string]bool))
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
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}

		if m.showKbar {
			var cmd tea.Cmd
			var model tea.Model
			model, cmd = m.kbarModel.Update(msg)
			m.kbarModel = model.(*kbarModel)
			switch msg.String() {
			case "esc", "alt+k": // TODO: bind to command modifier over option(alt)
				m.showKbar = false
			}
			return m, cmd
		}

		switch msg.String() {
		case "up":
			if m.cursor > CURSOR_TOP {
				m.cursor--
			} else {
				m.viewport.LineUp(SCROLL_STEP)
			}
		case "down":
			if m.cursor < min(CURSOR_BOTTOM, m.curLineNo-1) {
				m.cursor++
			} else {
				m.viewport.LineDown(SCROLL_STEP)
			}
		case " ":
			m.ToggleFolder()
		case "alt+k": // TODO: bind to command modifier over option(alt)
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
		// var err error
		// TODO: update fields

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
		)
	}

	return lipgloss.JoinVertical(lipgloss.Left,
		m.curGVK.String(),
		m.style.Render(m.viewport.View()),
		fmt.Sprintf("cursor: %d, lineNum: %d", m.cursor, m.curLineNo), // debug
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

		prefix := strings.Repeat(" ", field.Level*2)
		if m.IsCursor() {
			prefix += ">"
			m.curField = field
		} else {
			prefix += " "
		}
		if field.Foldable() {
			if field.Expanded {
				prefix += "-"
			} else {
				prefix += "+"
			}
		} else {
			prefix += " "
		}
		line := fmt.Sprintf("%s%s", prefix, field.String())
		if len(line) > VIEWPORT_WIDTH {
			line = line[:VIEWPORT_WIDTH-len(LINE_ELLIPSIS)] + LINE_ELLIPSIS
		}
		result.WriteString(line + "\n")
		m.curLineNo++

		if field.Children != nil && field.Expanded {
			result.WriteString(m.renderRecursive(field.Children))
		}
	}

	return result.String()
}
