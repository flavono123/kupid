package property

import (
	"k8s.io/kube-openapi/pkg/validation/spec"
)

type NodeBuilder struct {
	node *Node
}

func CreatePropertyNodeBuilder(
	schemaProps *spec.SchemaProps,
) *NodeBuilder {
	return &NodeBuilder{
		node: &Node{
			SchemaProps: schemaProps,
		},
	}
}

func (b *NodeBuilder) WithChildren(
	children map[string]*Node,
) *NodeBuilder {
	b.node.Children = children
	return b
}

func (b *NodeBuilder) WithNestedTypeChildren(
	nestedProp *spec.SchemaProps,
) *NodeBuilder {
	b.node.Children = map[string]*Node{
		"*": CreatePropertyNodeBuilder(nestedProp).Build(),
	}
	return b
}

func (b *NodeBuilder) Build() *Node {
	return b.node
}
