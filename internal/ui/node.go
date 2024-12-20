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
	prefix   []string
	level    int
	children map[string]*Node
}

func (n *Node) Foldable() bool {
	return n.children != nil
}

func (n *Node) render() string {
	name := lipgloss.NewStyle().Foreground(theme.Green)
	displayType := lipgloss.NewStyle().Foreground(theme.Peach)

	if n.Type() == "" {
		return name.Render(n.Name())
	}

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

func (n *Node) NodeFullPath() []string {
	fullPath := []string{}
	fullPath = append(fullPath, n.prefix...)
	fullPath = append(fullPath, n.name)
	return fullPath
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

// TODO: move to kube.Field, use for digging array or map(ref?) val to create node
func (n *Node) FullPath() []string {
	fullPath := []string{}
	if n.field == nil {
		return fullPath
	}
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

func createNodeTree(fieldTree map[string]*kube.Field, objs []*unstructured.Unstructured, nodePrefix []string) map[string]*Node {
	result := make(map[string]*Node)

	for key, field := range fieldTree {
		prefix := field.Prefix
		if !comparePrefix(nodePrefix, field.Prefix) {
			prefix = nodePrefix
		}

		childPrefix := append(prefix, key)
		children := map[string]*Node(nil)

		if strings.HasPrefix(field.Type, "[]") { // array; inject index keys
			maxLength := getMaxLength(childPrefix, objs)
			children = make(map[string]*Node)

			for i := 0; i < maxLength; i++ {
				idx := strconv.Itoa(i)
				grandChildren := map[string]*Node(nil)
				if field.Children != nil {
					grandChildren = createNodeTree(field.Children, objs, append(childPrefix, idx))
				}

				children[idx] = &Node{
					field:    nil,
					name:     idx,
					prefix:   childPrefix,
					level:    field.Level + 1,
					children: grandChildren,
				}
			}
		} else if strings.HasPrefix(field.Type, "map[string]") { // map; inject string keys
			keys := getDistinctKeys(childPrefix, objs)
			children = make(map[string]*Node)
			for _, key := range keys {
				grandChildren := map[string]*Node(nil)
				if field.Children != nil {
					grandChildren = createNodeTree(field.Children, objs, append(childPrefix, key))
				}

				children[key] = &Node{
					field:    nil,
					name:     key,
					prefix:   childPrefix,
					level:    field.Level + 1,
					children: grandChildren,
				}
			}

		} else if field.Children != nil {
			children = createNodeTree(field.Children, objs, childPrefix)
		}

		result[key] = &Node{
			field:    field,
			prefix:   prefix,
			name:     key,
			children: children,
		}
	}

	return result
}

func getMaxLength(arrayPath []string, objs []*unstructured.Unstructured) int {
	maxLength := 1 // if no array, return 1 to render only fields
	for _, obj := range objs {
		val, found, err := GetNestedValueWithIndex(obj.Object, arrayPath...)
		if err != nil || !found {
			continue
		}
		arr := val.([]interface{})
		if len(arr) > maxLength {
			maxLength = len(arr)
		}
	}
	return maxLength
}

func comparePrefix(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

func getDistinctKeys(mapPath []string, objs []*unstructured.Unstructured) []string {
	keys := []string{}
	exists := map[string]struct{}{}

	for _, obj := range objs {
		val, found, err := GetNestedValueWithIndex(obj.Object, mapPath...)
		if err != nil || !found {
			continue
		}
		mapString := val.(map[string]interface{})
		for k := range mapString {
			if _, ok := exists[k]; !ok {
				exists[k] = struct{}{}
				keys = append(keys, k)
			}
		}
	}

	return keys
}
