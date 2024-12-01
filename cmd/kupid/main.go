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
	content := printNodes(nodes, 0, 0, vp.YOffset, &m.currentLineNo)
	vp.SetContent(content)

	return m
}

func (m *model) Init() tea.Cmd {
	return nil
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
			if m.cursor < 19 { // TODO: should guard the cursor disapears to the last newline
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
	content := printNodes(m.nodes, 0, m.cursor, m.viewport.YOffset, &m.currentLineNo)
	m.viewport.SetContent(content)
	return m.style.Render(m.viewport.View()) + "\n" + fmt.Sprintf("cursor: %d, lineNum: %d", m.cursor, m.currentLineNo)
}

func printNodes(nodes map[string]*property.Node, indent int, cursor int, viewportOffset int, lineNum *int) string {
	var result strings.Builder
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		node := nodes[key]
		displayType := strings.Join(property.GetType(node.SchemaProps), "|")
		if len(displayType) == 0 {
			displayType = property.GetRefKey(node.SchemaProps)
		}

		isCursor := *lineNum-viewportOffset == cursor

		prefix := strings.Repeat(" ", indent*2)
		if isCursor {
			prefix += ">"
		} else {
			prefix += " "
		}

		if node.Foldable() {
			prefix += "-"
		} else {
			prefix += " "
		}

		result.WriteString(fmt.Sprintf("%s%s(%s)\n", prefix, key, displayType))
		*lineNum++

		if node.Children != nil {
			result.WriteString(printNodes(node.Children, indent+1, cursor, viewportOffset, lineNum))
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
