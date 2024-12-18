package ui

import (
	"fmt"
	"log"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

type schemaModel struct {
	// fields map[string]*kube.Field
	nodes map[string]*Node

	vp     viewport.Model
	width  int
	height int

	style     lipgloss.Style
	cursor    int
	curLineNo int
	// curField  *kube.Field
	curNode *Node

	curGVK schema.GroupVersionKind

	keys schemaKeyMap
	help help.Model
}

func newSchemaModel(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) *schemaModel {
	fields, err := kube.CreateFieldTree(gvk)
	nodes := createNodeTree(fields, objs, []string{})
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
		nodes:  nodes,
		vp:     vp,
		width:  width,
		height: height,
		style:  style,
		cursor: 0,
		curGVK: gvk,
		keys:   newSchemaKeyMap(),
		help:   help.New(),
	}
	content := m.renderRecursive(m.nodes)
	content = strings.TrimSuffix(content, "\n")
	vp.SetContent(content)

	return m
}

func (m *schemaModel) Init() tea.Cmd {
	return nil
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
			if m.curNode == nil {
				break
			}

			if m.curNode.Foldable() {
				m.toggleFolder()
			} else { // selectable, for leaf fields
				if m.curNode.Selected {
					m.curNode.Selected = false
					retCmd = func() tea.Msg {
						return unpickFieldMsg{node: m.curNode}
					}
				} else {
					m.curNode.Selected = true
					retCmd = func() tea.Msg {
						return pickFieldMsg{node: m.curNode}
					}
				}
			}
		}
	}

	return m, retCmd
}

func (m *schemaModel) View() string {
	m.curLineNo = 0 // to avoid accumulating line number infinitely
	content := m.renderRecursive(m.nodes)
	content = strings.TrimSuffix(content, "\n")
	m.vp.SetContent(content)

	return lipgloss.JoinVertical(lipgloss.Left,
		m.style.Render(m.vp.View()),
		// m.help.View(m.keys),
		fmt.Sprintf("%v", m.curNode.FullPath()),
		fmt.Sprintf("%v", m.curNode.NodeFullPath()),
	)
}

// utils
func (m *schemaModel) isCursor() bool {
	return m.curLineNo-m.vp.YOffset == m.cursor
}

func (m *schemaModel) toggleFolder() {
	if m.curNode != nil && m.curNode.Foldable() {
		m.curNode.Expanded = !m.curNode.Expanded
	}
}

func (m *schemaModel) renderRecursive(nodes map[string]*Node) string {
	var result strings.Builder
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		if key == "apiVersion" || key == "kind" || key == "metadata" {
			continue
		}
		node := nodes[key]

		indent := strings.Repeat(" ", node.Level()*2)
		var cursorStr string
		cursor := lipgloss.NewStyle().Foreground(theme.Text)
		if m.isCursor() {
			cursorStr = ">"
			m.curNode = node
		} else {
			cursorStr = " "
		}
		folder := lipgloss.NewStyle().Foreground(theme.Subtext1)
		var foldStr string
		if node.Foldable() {
			if node.Expanded {
				foldStr = "-"
			} else {
				foldStr = "+"
			}
		} else { // selectable
			if node.Selected {
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
			node.render(),
		)) + "\n")
		m.curLineNo++

		if node.children != nil && node.Expanded {
			result.WriteString(m.renderRecursive(node.children))
		}
	}

	return result.String()
}

func (m *schemaModel) Reset(gvk schema.GroupVersionKind, objs []*unstructured.Unstructured) {
	m.curGVK = gvk // TODO: check if this is necessary
	fields, err := kube.CreateFieldTree(m.curGVK)
	if err != nil {
		log.Fatalf("failed to create field tree: %v", err)
	}
	nodes := createNodeTree(fields, objs, []string{})
	m.nodes = nodes
	m.cursor = 0
}
