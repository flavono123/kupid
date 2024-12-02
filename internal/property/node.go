package property

import (
	"k8s.io/kube-openapi/pkg/validation/spec"
)

type Node struct {
	SchemaProps  *spec.SchemaProps
	PropType     string
	NestedType   string // for array if it has no child prop in ref
	NestedRefKey string // for array if it has child ref
	Children     map[string]*Node
}

func (n *Node) Foldable() bool {
	if Type(n.SchemaProps) == "array" && n.NestedRefKey != "" {
		return true
	}

	if n.PropType == "object" {
		return true
	}

	return false
}

func HasType(prop *spec.SchemaProps) bool {
	return prop.Type != nil && len(prop.Type) > 0
}

func Type(prop *spec.SchemaProps) string {
	if !HasType(prop) {
		return ""
	}

	return prop.Type[0]
}

func HasProperties(prop *spec.SchemaProps) bool {
	return prop.Properties != nil && len(prop.Properties) > 0
}

func (n *Node) HasProperties() bool {
	return n.SchemaProps.Properties != nil && len(n.SchemaProps.Properties) > 0
}

func GetRefKey(prop *spec.SchemaProps) string {
	var ref spec.Ref
	if prop.AllOf != nil && len(prop.AllOf) > 0 {
		ref = prop.AllOf[0].Ref
	} else {
		ref = prop.Ref
	}

	tokens := ref.GetPointer().DecodedTokens()
	if len(tokens) == 0 {
		return ""
	}
	refKey := tokens[len(tokens)-1] // 2

	return refKey
}

func GetType(prop *spec.SchemaProps) []string {
	var result []string

	if HasType(prop) {
		result = prop.Type
	} else if HasAllOf(prop) {
		for _, schema := range prop.AllOf {
			result = append(result, GetType(&schema.SchemaProps)...)
		}
	} else if HasOneOf(prop) {
		for _, schema := range prop.OneOf {
			result = append(result, GetType(&schema.SchemaProps)...)
		}
	} else if HasAnyOf(prop) {
		for _, schema := range prop.AnyOf {
			result = append(result, GetType(&schema.SchemaProps)...)
		}
	}

	return result
}

func HasAllOf(prop *spec.SchemaProps) bool {
	return prop.AllOf != nil && len(prop.AllOf) > 0
}

func HasOneOf(prop *spec.SchemaProps) bool {
	return prop.OneOf != nil && len(prop.OneOf) > 0
}

func HasAnyOf(prop *spec.SchemaProps) bool {
	return prop.AnyOf != nil && len(prop.AnyOf) > 0
}
