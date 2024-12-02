package main

import (
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/property"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type model struct {
	nodes         map[string]*property.Node
	viewport      viewport.Model
	style         lipgloss.Style
	cursor        int
	currentLineNo int
}

func newModel() *model {
	nodes, err := kube.GetNodes("io.k8s.api.core.v1.Pod")
	// nodes, err := kube.GetNodes("io.k8s.api.core.v1.Node")
	if err != nil {
		log.Fatalf("failed to get nodes: %v", err)
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("white"))

	vp := viewport.New(80, 20)
	m := &model{
		nodes:    nodes,
		viewport: vp,
		style:    style,
		cursor:   0,
	}
	content := printNodes(nodes, 0, m)
	content = strings.TrimSuffix(content, "\n")
	vp.SetContent(content)

	return m
}

func (m *model) Init() tea.Cmd {
	return nil
}

func (m *model) IsCursor() bool {
	return m.currentLineNo-m.viewport.YOffset == m.cursor
}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "up":
			if m.cursor > 0 {
				m.cursor--
			} else {
				m.viewport.LineUp(1)
			}
		case "down":
			if m.cursor < 20-1 {
				m.cursor++
			} else {
				m.viewport.LineDown(1)
			}
		}
	}
	return m, nil
}

func (m *model) View() string {
	m.currentLineNo = 0
	content := printNodes(m.nodes, 0, m)
	content = strings.TrimSuffix(content, "\n")
	m.viewport.SetContent(content)
	return m.style.Render(m.viewport.View()) + "\n" + fmt.Sprintf("cursor: %d, lineNum: %d", m.cursor, m.currentLineNo)
}

func printNodes(nodes map[string]*property.Node, indent int, model *model) string {
	var result strings.Builder
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		node := nodes[key]

		// displayType := property.DisplayType(node, true)
		displayType := property.DisplayType(node, false)

		prefix := strings.Repeat(" ", indent*2)
		if model.IsCursor() {
			prefix += ">"
		} else {
			prefix += " "
		}

		if node.Foldable() {
			prefix += "-"
		} else {
			prefix += " "
		}

		line := fmt.Sprintf("%s%s(%s)\n", prefix, key, displayType)

		// truncate 80
		if len(line) > 80 {
			line = line[:77] + "...\n"
		}
		result.WriteString(line)
		model.currentLineNo++

		if node.Children != nil {
			result.WriteString(printNodes(node.Children, indent+1, model))
		}
	}
	return result.String()
}

func main() {
	program := tea.NewProgram(
		newModel(),
		tea.WithAltScreen(),
	)
	if _, err := program.Run(); err != nil {
		log.Fatalf("failed to run program: %v", err)
		os.Exit(1)
	}
}
