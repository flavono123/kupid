package kube

import (
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Node struct {
	Expanded bool
	Selected bool
	// TODO: new field to represent the values of node are all nil
	// reversed this would be a Line's Essential field(tbd), to reduce of schema context

	field     *Field
	name      string
	ancestors []string
	level     int
	children  map[string]*Node
}

// line things
func (n *Node) ToggleFolder() {
	if n.Foldable() {
		n.Expanded = !n.Expanded
	}
}

func (n *Node) SetExpanded(expanded bool) {
	n.Expanded = expanded
}

func (n *Node) Foldable() bool {
	return n.children != nil
}

// line things end

func (n *Node) Children() map[string]*Node {
	return n.children
}

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

// TODO: move to kube*Field, use for digging array or map(ref?) val to create node
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

func CreateNodeTree(fieldTree map[string]*Field, objs []*unstructured.Unstructured, nodePrefix []string) map[string]*Node {
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
					grandChildren = CreateNodeTree(field.Children, objs, append(childPrefix, idx))
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
					grandChildren = CreateNodeTree(field.Children, objs, append(childPrefix, key))
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
			children = CreateNodeTree(field.Children, objs, childPrefix)
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

// TODO: rename to more generic, not only for array nodes
func GetNestedValueWithIndex(obj map[string]interface{}, fields ...string) (interface{}, bool, error) {
	var current interface{} = obj

	for i, field := range fields {
		// 숫자인지 확인 (배열 인덱스)
		if index, err := strconv.Atoi(field); err == nil {
			// 현재 값이 슬라이스인지 확인
			if slice, ok := current.([]interface{}); ok {
				if index >= len(slice) {
					return nil, false, fmt.Errorf("index %d out of bounds", index)
				}
				current = slice[index]
			} else {
				return nil, false, fmt.Errorf("expected array, got %T", current)
			}
		} else {
			// 맵인지 확인
			if m, ok := current.(map[string]interface{}); ok {
				var exists bool
				current, exists = m[field]
				if !exists {
					return nil, false, nil
				}
			} else {
				return nil, false, fmt.Errorf("expected map, got %T", current)
			}
		}

		// 마지막 필드면 현재 값 반환
		if i == len(fields)-1 {
			return current, true, nil
		}
	}

	return current, true, nil
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
func UpdateNodeTree(existing map[string]*Node, fieldTree map[string]*Field, objs []*unstructured.Unstructured, nodePrefix []string) map[string]*Node {
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
					grandChildren = UpdateNodeTree(existingChildren, field.Children, objs, append(childPrefix, idx))
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
					grandChildren = UpdateNodeTree(existingChildren, field.Children, objs, append(childPrefix, mapKey))
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
			children = UpdateNodeTree(existingChildren, field.Children, objs, childPrefix)
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
