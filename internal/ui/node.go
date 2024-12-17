package ui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
)

type Node struct {
	Expanded bool
	Selected bool

	field    *kube.Field
	children map[string]*Node
}

func (n *Node) Foldable() bool {
	return n.children != nil
}

func (n *Node) render() string {
	name := lipgloss.NewStyle().Foreground(theme.Green)
	displayType := lipgloss.NewStyle().Foreground(theme.Peach)
	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		name.Render(n.Name()),
		displayType.Render(fmt.Sprintf("<%s>", n.Type())),
	)
}

// delegate to kube.Field's field

func (n *Node) Name() string {
	if n.field == nil {
		return ""
	}
	return n.field.Name
}

func (n *Node) Prefix() []string {
	if n.field == nil {
		return nil
	}
	return n.field.Prefix
}

func (n *Node) Type() string {
	if n.field == nil {
		return ""
	}
	return n.field.Type
}

func (n *Node) Required() bool {
	if n.field == nil {
		return false
	}
	return n.field.Required
}

func (n *Node) FullPath() []string {
	if n.field == nil {
		return []string{}
	}
	fullPath := []string{}
	fullPath = append(fullPath, n.field.Prefix...)
	fullPath = append(fullPath, n.field.Name)
	return fullPath
}

func createNodeTree(fieldTree map[string]*kube.Field) map[string]*Node {
	result := make(map[string]*Node)

	for key, field := range fieldTree {
		if field.Children == nil {
			result[key] = &Node{
				field:    field,
				children: nil,
			}
		} else {
			children := createNodeTree(field.Children)
			result[key] = &Node{
				field:    field,
				children: children,
			}
		}
	}

	return result
}
