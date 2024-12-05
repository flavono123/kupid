package ui

import (
	"fmt"
	"log"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"

	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/property"
)

const (
	START_INDENT    = 0
	VIEWPORT_WIDTH  = 80
	VIEWPORT_HEIGHT = 20
	LINE_ELLIPSIS   = "...\n"
	CURSOR_TOP      = 0
	CURSOR_BOTTOM   = VIEWPORT_HEIGHT - 1
	SCROLL_STEP     = 1
	VERBOSE_TYPE    = false
)

type schemaModel struct {
	nodes     map[string]*property.Node
	viewport  viewport.Model
	style     lipgloss.Style
	cursor    int
	curLineNo int
	curNode   *property.Node

	kbarModel *kbarModel
	showKbar  bool
}

func NewSchemaModel() *schemaModel {
	nodes, err := kube.GetNodes("io.k8s.api.core.v1.Pod")
	// nodes, err := kube.GetNodes("io.k8s.api.core.v1.Node")
	if err != nil {
		log.Fatalf("failed to get nodes: %v", err)
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("white"))

	vp := viewport.New(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	m := &schemaModel{
		nodes:     nodes,
		viewport:  vp,
		style:     style,
		cursor:    0,
		kbarModel: NewKbarModel(),
	}
	content := printNodes(nodes, START_INDENT, m)
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
	if m.curNode != nil && m.curNode.Foldable() {
		m.curNode.Expanded = !m.curNode.Expanded
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
			if msg.String() == "k" || msg.String() == "esc" {
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
		case "k":
			m.showKbar = !m.showKbar
		}
		return m, nil
	}
	return m, nil
}

func (m *schemaModel) View() string {
	m.curLineNo = 0 // to avoid accumulating line number infinitely
	content := printNodes(m.nodes, START_INDENT, m)
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

	return m.style.Render(m.viewport.View()) +
		"\n" + fmt.Sprintf("cursor: %d, lineNum: %d", m.cursor, m.curLineNo) // debug
}

func printNodes(nodes map[string]*property.Node, indent int, sm *schemaModel) string {
	var result strings.Builder
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		node := nodes[key]

		displayType := property.DisplayType(node, VERBOSE_TYPE)

		// - make prefix
		// indent
		prefix := strings.Repeat(" ", indent*2)

		// cursor
		if sm.IsCursor() {
			prefix += ">"
			sm.curNode = node
		} else {
			prefix += " "
		}

		// folder
		if node.Foldable() {
			if node.Expanded {
				prefix += "-"
			} else {
				prefix += "+"
			}
		} else {
			prefix += " "
		}

		line := fmt.Sprintf("%s%s(%s)\n", prefix, key, displayType)

		// truncate over viewport width
		if len(line) > VIEWPORT_WIDTH {
			line = line[:VIEWPORT_WIDTH-len(LINE_ELLIPSIS)] + LINE_ELLIPSIS
		}

		result.WriteString(line)
		sm.curLineNo++

		if node.Children != nil && node.Expanded {
			result.WriteString(printNodes(node.Children, indent+1, sm))
		}
	}
	return result.String()
}
