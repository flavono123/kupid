package ui

import "github.com/flavono123/kupid/internal/kube"

type Node struct {
	field *kube.Field

	children map[string]*Node
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

// START: THIS SHOULD BE NODE's FIELD
func (n *Node) Expanded() bool {
	if n.field == nil {
		return false
	}
	return n.field.Expanded
}

func (n *Node) Selected() bool {
	if n.field == nil {
		return false
	}
	return n.field.Selected
}

func (n *Node) FullPath() []string {
	if n.field == nil {
		return nil
	}
	return n.field.FullPath()
}

// END: THIS SHOULD BE NODE's FIELD

func (n *Node) Foldable() bool {
	return n.children != nil
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
