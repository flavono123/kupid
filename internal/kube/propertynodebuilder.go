package kube

import "k8s.io/kube-openapi/pkg/validation/spec"

type PropertyNodeBuilder struct {
	node *PropertyNode
}

func CreatePropertyNodeBuilder(
	schemaProps *spec.SchemaProps,
) *PropertyNodeBuilder {
	return &PropertyNodeBuilder{
		node: &PropertyNode{
			SchemaProps: schemaProps,
		},
	}
}

func (b *PropertyNodeBuilder) WithChildren(
	children map[string]*PropertyNode,
) *PropertyNodeBuilder {
	b.node.Children = children
	return b
}

func (b *PropertyNodeBuilder) WithNestedTypeChildren(
	nestedProp *spec.SchemaProps,
) *PropertyNodeBuilder {
	b.node.Children = map[string]*PropertyNode{
		"*": CreatePropertyNodeBuilder(nestedProp).Build(),
	}
	return b
}

func (b *PropertyNodeBuilder) Build() *PropertyNode {
	return b.node
}
