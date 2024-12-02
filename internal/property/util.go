package property

import (
	"strings"

	"k8s.io/kube-openapi/pkg/validation/spec"
)

func GetRefKey(prop *spec.SchemaProps) string {
	var ref spec.Ref
	if HasAllOf(prop) {
		ref = prop.AllOf[0].Ref
	} else {
		ref = prop.Ref
	}

	tokens := ref.GetPointer().DecodedTokens()
	if len(tokens) == 0 {
		return ""
	}
	refKey := tokens[len(tokens)-1] // [2]

	return refKey
}

func GetType(prop *spec.SchemaProps) string {
	var result []string

	if HasAllOf(prop) {
		for _, schema := range prop.AllOf {
			result = append(result, GetType(&schema.SchemaProps))
		}
	} else if HasOneOf(prop) {
		for _, schema := range prop.OneOf {
			result = append(result, GetType(&schema.SchemaProps))
		}
	} else if HasType(prop) {
		result = prop.Type
	} else {
		result = []string{"object"}
	}

	return strings.Join(result, "|")
}

func HasAllOf(prop *spec.SchemaProps) bool {
	return prop.AllOf != nil && len(prop.AllOf) > 0
}

func HasOneOf(prop *spec.SchemaProps) bool {
	return prop.OneOf != nil && len(prop.OneOf) > 0
}

func HasProperties(prop *spec.SchemaProps) bool {
	return prop.Properties != nil && len(prop.Properties) > 0
}

func HasType(prop *spec.SchemaProps) bool {
	return prop.Type != nil && len(prop.Type) > 0
}
