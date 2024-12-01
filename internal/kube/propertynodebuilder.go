package kube

import (
	"github.com/flavono123/kupid/internal/property"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

type PropertyNodeBuilder struct {
	node *property.PropertyNode
}

func CreatePropertyNodeBuilder(
	schemaProps *spec.SchemaProps,
) *PropertyNodeBuilder {
	return &PropertyNodeBuilder{
		node: &property.PropertyNode{
			SchemaProps: schemaProps,
		},
	}
}

func (b *PropertyNodeBuilder) WithChildren(
	children map[string]*property.PropertyNode,
) *PropertyNodeBuilder {
	b.node.Children = children
	return b
}

func (b *PropertyNodeBuilder) WithNestedTypeChildren(
	nestedProp *spec.SchemaProps,
) *PropertyNodeBuilder {
	b.node.Children = map[string]*property.PropertyNode{
		"*": CreatePropertyNodeBuilder(nestedProp).Build(),
	}
	return b
}

func (b *PropertyNodeBuilder) Build() *property.PropertyNode {
	return b.node
}
