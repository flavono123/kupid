package property

import (
	"fmt"

	"k8s.io/kube-openapi/pkg/validation/spec"
)

type Node struct {
	// property concern
	SchemaProps  *spec.SchemaProps
	PropType     string
	NestedType   string // for array if it has no child prop in ref
	NestedRefKey string // for array or object if it has child ref
	Children     map[string]*Node

	// ui concern
	Expanded bool
}

func DisplayType(node *Node, verbose bool) string {
	var result string

	propType := GetType(node.SchemaProps)
	result = propType
	if verbose {
		if propType == "array" || propType == "object" {
			if node.NestedType != "" {
				result += fmt.Sprintf("<%s>", node.NestedType)
			} else { // should have child ref
				nestedRefKey := node.NestedRefKey
				result += fmt.Sprintf("<%s>", nestedRefKey)
			}
		}
	}

	return result
}

func (n *Node) Foldable() bool {
	propType := GetType(n.SchemaProps)
	if (propType == "array" || propType == "object") && n.NestedRefKey != "" {
		return true
	}

	return false
}
