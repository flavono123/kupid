package ui

import "github.com/flavono123/kupid/internal/kube"

type Node struct {
	Expanded bool
	Selected bool

	field    *kube.Field
	children map[string]*Node
}

func (n *Node) Foldable() bool {
	return n.children != nil
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

// END: THIS SHOULD BE NODE's FIELD

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
