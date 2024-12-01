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
	nodes    map[string]*property.Node
	viewport viewport.Model
	style    lipgloss.Style
}

func newModel() *model {
	nodes, err := kube.GetNodes("io.k8s.api.core.v1.Node")
	if err != nil {
		log.Fatalf("failed to get nodes: %v", err)
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("white"))

	vp := viewport.New(80, 20)
	content := printNodes(nodes, 0)
	vp.SetContent(content)

	return &model{
		nodes:    nodes,
		viewport: vp,
		style:    style,
	}
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
			m.viewport.LineUp(1)
		case "down":
			m.viewport.LineDown(1)
		}
	}
	return m, nil
}

func (m *model) View() string {
	content := printNodes(m.nodes, 0)
	m.viewport.SetContent(content)
	return m.style.Render(m.viewport.View())
}

func printNodes(nodes map[string]*property.Node, indent int) string {
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
		result.WriteString(fmt.Sprintf("%s(%s)\n", strings.Repeat(" ", indent*2)+key, displayType))
		if node.Children != nil {
			result.WriteString(printNodes(node.Children, indent+1))
		}
	}
	return result.String()
}

func main() {
	program := tea.NewProgram(newModel())
	if _, err := program.Run(); err != nil {
		log.Fatalf("failed to run program: %v", err)
		os.Exit(1)
	}
}
