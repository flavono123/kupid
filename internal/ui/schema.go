package ui

import (
	"fmt"
	"log"
	"sort"
	"strconv"
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
	curNode   *Node
	curGVK    schema.GroupVersionKind

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
				m.toggleCurrentNodeFolder()
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
		case key.Matches(msg, m.keys.levelExpand):
			if m.curNode != nil && m.curNode.Foldable() {
				toggledExpanded := !m.curNode.Expanded
				m.toggleExpandRecursive(m.nodes, toggledExpanded, false)
			}
		case key.Matches(msg, m.keys.allExpand):
			if m.curNode != nil && m.curNode.Foldable() {
				toggledExpanded := !m.curNode.Expanded
				m.toggleExpandRecursive(m.nodes, toggledExpanded, true)
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

	// TODO: responsibility of rendering cursor is up to the new struct, line
	// if m.cursor > m.curLineNo-1 {
	// 	m.cursor = min(m.curLineNo-1, SCHEMA_CURSOR_BOTTOM)
	// }

	return lipgloss.JoinVertical(lipgloss.Left,
		m.style.Render(m.vp.View()),
		// m.help.View(m.keys),
		fmt.Sprintf("cursor: %d, curLineNo: %d", m.cursor, m.curLineNo),
	)
}

// utils
func (m *schemaModel) isCursor() bool {
	return m.curLineNo-m.vp.YOffset == m.cursor
}

func (m *schemaModel) toggleCurrentNodeFolder() {
	m.curNode.toggleFolder()
}

func (m *schemaModel) toggleExpandRecursive(nodes map[string]*Node, expand bool, all bool) {
	if m.curNode == nil {
		return
	}

	for _, node := range nodes {
		if all || (node.Level() == m.curNode.Level()) {
			node.setExpanded(expand)
		}

		m.toggleExpandRecursive(node.children, expand, all)
	}
}

func (m *schemaModel) renderRecursive(nodes map[string]*Node) string {
	var result strings.Builder
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sortKeys(keys)

	for _, key := range keys {
		if key == "apiVersion" || key == "kind" {
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

		if node.Expanded {
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

func sortKeys(keys []string) {
	if len(keys) == 0 {
		return
	}

	_, err := strconv.Atoi(keys[0])
	if err != nil {
		sort.Strings(keys)
	} else {
		sort.Slice(keys, func(i, j int) bool {
			numI, _ := strconv.Atoi(keys[i])
			numJ, _ := strconv.Atoi(keys[j])
			return numI < numJ
		})
	}
}
