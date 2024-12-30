package ui

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/theme"
)

type Node struct {
	Expanded bool
	Selected bool
	// TODO: new field to represent the values of node are all nil
	// reversed this would be a Line's Essential field(tbd), to reduce of schema context

	field     *kube.Field
	name      string
	ancestors []string
	level     int
	children  map[string]*Node
}

// line things
func (n *Node) toggleFolder() {
	if n.Foldable() {
		n.Expanded = !n.Expanded
	}
}

func (n *Node) setExpanded(expanded bool) {
	n.Expanded = expanded
}

func (n *Node) Foldable() bool {
	return n.children != nil
}

// line things end

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
	fullPath = append(fullPath, n.ancestors...)
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
					field:     nil,
					name:      idx,
					ancestors: childPrefix,
					level:     field.Level + 1,
					children:  grandChildren,
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
					field:     nil,
					name:      key,
					ancestors: childPrefix,
					level:     field.Level + 1,
					children:  grandChildren,
				}
			}

		} else if field.Children != nil {
			children = createNodeTree(field.Children, objs, childPrefix)
		}

		result[key] = &Node{
			field:     field,
			ancestors: prefix,
			name:      key,
			children:  children,
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

// TODO: refactor, pull up traverse with create to function
// TODO: besides, expandedNodes should be a state of the schemaModel(ideally expand would not be a state of node)
func updateNodeTree(existing map[string]*Node, fieldTree map[string]*kube.Field, objs []*unstructured.Unstructured, nodePrefix []string) map[string]*Node {
	result := make(map[string]*Node)

	for key, field := range fieldTree {
		prefix := field.Prefix
		if !comparePrefix(nodePrefix, field.Prefix) {
			prefix = nodePrefix
		}

		childPrefix := append(prefix, key)
		var children map[string]*Node

		existingNode, exists := existing[key]
		expanded := exists && existingNode.Expanded
		selected := exists && existingNode.Selected

		if strings.HasPrefix(field.Type, "[]") {
			maxLength := getMaxLength(childPrefix, objs)
			children = make(map[string]*Node)

			for i := 0; i < maxLength; i++ {
				idx := strconv.Itoa(i)
				var grandChildren map[string]*Node

				if field.Children != nil {
					existingChildren := map[string]*Node{}
					if exists && existingNode.children != nil {
						existingChildren = existingNode.children[idx].children
					}
					grandChildren = updateNodeTree(existingChildren, field.Children, objs, append(childPrefix, idx))
				}

				children[idx] = &Node{
					field:     nil,
					name:      idx,
					ancestors: childPrefix,
					level:     field.Level + 1,
					children:  grandChildren,
					Expanded:  exists && existingNode.children != nil && existingNode.children[idx] != nil && existingNode.children[idx].Expanded,
					Selected:  exists && existingNode.children != nil && existingNode.children[idx] != nil && existingNode.children[idx].Selected,
				}
			}
		} else if strings.HasPrefix(field.Type, "map[string]") {
			keys := getDistinctKeys(childPrefix, objs)
			children = make(map[string]*Node)

			for _, mapKey := range keys {
				var grandChildren map[string]*Node

				if field.Children != nil {
					existingChildren := map[string]*Node{}
					if exists && existingNode.children != nil {
						if existingChild, ok := existingNode.children[mapKey]; ok {
							existingChildren = existingChild.children
						}
					}
					grandChildren = updateNodeTree(existingChildren, field.Children, objs, append(childPrefix, mapKey))
				}

				children[mapKey] = &Node{
					field:     nil,
					name:      mapKey,
					ancestors: childPrefix,
					level:     field.Level + 1,
					children:  grandChildren,
					Expanded:  exists && existingNode.children != nil && existingNode.children[mapKey] != nil && existingNode.children[mapKey].Expanded,
					Selected:  exists && existingNode.children != nil && existingNode.children[mapKey] != nil && existingNode.children[mapKey].Selected,
				}
			}
		} else if field.Children != nil {
			existingChildren := map[string]*Node{}
			if exists {
				existingChildren = existingNode.children
			}
			children = updateNodeTree(existingChildren, field.Children, objs, childPrefix)
		}

		result[key] = &Node{
			field:     field,
			ancestors: prefix,
			name:      key,
			children:  children,
			Expanded:  expanded,
			Selected:  selected,
		}
	}

	return result
}
