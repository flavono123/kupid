package ui

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Node struct {
	Expanded bool
	Selected bool

	field    *kube.Field
	name     string
	level    int
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
		return n.name
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

func (n *Node) Level() int {
	if n.field == nil {
		return n.level
	}
	return n.field.Level
}

func createNodeTree(fieldTree map[string]*kube.Field, objs []*unstructured.Unstructured) map[string]*Node {
	result := make(map[string]*Node)

	for key, field := range fieldTree {
		if field.Children == nil {
			result[key] = &Node{
				field:    field,
				children: nil,
			}
		} else {
			if strings.HasPrefix(field.Type, "[]") {
				grandChildren := createNodeTree(field.Children, objs)
				maxLength := 1 //getMaxLength(field.Prefix, objs)
				children := make(map[string]*Node)
				for i := 0; i < maxLength; i++ {
					idx := strconv.Itoa(i)
					child := Node{
						field:    nil,
						name:     idx,
						level:    field.Level + 1,
						children: grandChildren,
					}
					children[idx] = &child
				}
				result[key] = &Node{
					field:    field,
					children: children,
				}
			} else {
				children := createNodeTree(field.Children, objs)
				result[key] = &Node{
					field:    field,
					children: children,
				}
			}
		}
	}

	return result
}

// func getMaxLength(arrayPath []string, objs []*unstructured.Unstructured) int {
// 	maxLength := 1 // if no array, return 1 to render only fields
// 	for _, obj := range objs {
// 		val, found, err := unstructured.NestedFieldNoCopy(obj.Object, arrayPath...)
// 		if err != nil || !found {
// 			continue
// 		}
// 		arr := val.([]interface{})
// 		if len(arr) > maxLength {
// 			maxLength = len(arr)
// 		}
// 	}
// 	return maxLength
// }
