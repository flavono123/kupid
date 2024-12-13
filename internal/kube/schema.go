package kube

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/go-openapi/jsonreference"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func GetDocument(gvr schema.GroupVersionResource) (*spec3.OpenAPI, error) {
	var result *spec3.OpenAPI

	discoveryClient, err := DiscoveryClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get discovery client: %v", err)
	}

	openapiv3 := discoveryClient.OpenAPIV3()

	paths, err := openapiv3.Paths()
	if err != nil {
		return nil, fmt.Errorf("failed to get openapi paths: %v", err)
	}
	schemabytes, err := paths[getDocumentPath(gvr)].Schema(runtime.ContentTypeJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to get openapi schema: %v", err)
	}
	var document *spec3.OpenAPI
	if err := json.Unmarshal(schemabytes, &document); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema: %v", err)
	}
	result = document

	return result, nil
}

func getPathPrefix(gvr schema.GroupVersionResource) string {
	if gvr.Group != "" {
		return "/apis/" + gvr.Group
	}

	return "/api"
}

func FindGVK(document *spec3.OpenAPI, paths []string) *schema.GroupVersionKind {
	methods := []string{"get", "post", "put", "patch", "delete"}

	// 각 경로에 대해 검색
	for _, searchPath := range paths {
		// paths에서 해당 경로의 PathItem 찾기
		pathItem, exists := document.Paths.Paths[searchPath]
		if !exists {
			continue
		}

		// 각 HTTP 메서드에 대해 검색
		for _, method := range methods {
			var operation *spec3.Operation
			// 메서드에 따라 적절한 Operation 가져오기
			switch method {
			case "get":
				operation = pathItem.Get
			case "post":
				operation = pathItem.Post
			case "put":
				operation = pathItem.Put
			case "patch":
				operation = pathItem.Patch
			case "delete":
				operation = pathItem.Delete
			}

			if operation == nil {
				continue
			}

			// x-kubernetes-group-version-kind 확장 필드 확인
			if gvk, exists := operation.Extensions["x-kubernetes-group-version-kind"]; exists {
				// Extension은 interface{}로 저장되어 있으므로 적절한 타입으로 변환
				if gvkMap, ok := gvk.(map[string]interface{}); ok {
					return &schema.GroupVersionKind{
						Group:   gvkMap["group"].(string),
						Version: gvkMap["version"].(string),
						Kind:    gvkMap["kind"].(string),
					}
				}
			}
		}
	}

	return nil
}

// FindSchema searches for a schema with the given GVK in the OpenAPI document
func FindSchema(document *spec3.OpenAPI, gvk schema.GroupVersionKind) (*spec.Schema, error) {
	// components/schemas에서 GVK에 해당하는 스키마 찾기
	for _, schema := range document.Components.Schemas {
		if matchXKubeGVK(schema.Extensions, gvk) {
			return schema, nil
		}
	}

	return nil, fmt.Errorf("GVK %v not found in OpenAPI schema", gvk)
}

func matchXKubeGVK(extension spec.Extensions, gvk schema.GroupVersionKind) bool {
	gvkList, ok := extension["x-kubernetes-group-version-kind"]
	if !ok {
		return false
	}

	if list, ok := gvkList.([]interface{}); ok {
		for _, item := range list {
			if gvkMap, ok := item.(map[string]interface{}); ok {
				if gvkMap["group"] == gvk.Group && gvkMap["version"] == gvk.Version && gvkMap["kind"] == gvk.Kind {
					return true
				}
			}
		}
	}

	return false
}

func CreateFieldTree(gvk schema.GroupVersionKind) (map[string]*Field, error) {
	gvr, err := GetGVR(gvk)
	if err != nil {
		return nil, err
	}
	document, err := GetDocument(gvr)
	if err != nil {
		return nil, err
	}
	schema, err := FindSchema(document, gvk)
	if err != nil {
		return nil, err
	}
	history := make(map[string]bool)

	// 참조 문자열 가져오기
	refString := schema.Ref.String()

	// 순환 참조 감지
	// if refString != "" {
	// 	if history[refString] {
	// 		return nil, nil
	// 	}
	// 	history[refString] = true
	// }

	// 스키마 해석 (참조인 경우 참조를 따라감
	if resolved := resolveRef(refString, document); resolved != nil {
		schema = resolved
	}

	nodes, err := createFieldList(schema, 0, document, history)
	if err != nil {
		return nil, err
	}

	return nodes, nil
}

func createFieldList(schema *spec.Schema, level int, document *spec3.OpenAPI, history map[string]bool) (map[string]*Field, error) {
	var result map[string]*Field
	nodes := make(map[string]*Field)

	if schema == nil {
		return nil, fmt.Errorf("schema is nil")
	}

	refString := schema.Ref.String()
	if refString != "" {
		if history[refString] {
			return nil, nil
		}
		history[refString] = true
	}

	resolvedSchema := schema
	if resolved := resolveRef(refString, document); resolved != nil {
		resolvedSchema = resolved
	}

	for key, prop := range resolvedSchema.Properties {
		children, err := createFieldList(&prop, level+1, document, history)
		if err != nil {
			return nil, err
		}
		node := createField(key, resolvedSchema, level, document)
		node.Children = children
		nodes[key] = node

		result = nodes
	}

	for _, subSchema := range resolvedSchema.AllOf {
		nodes, err := createFieldList(&subSchema, level, document, history)
		if err != nil {
			return nil, err
		}
		result = nodes
	}

	if resolvedSchema.Items != nil {
		nodes, err := createFieldList(resolvedSchema.Items.Schema, level, document, history)
		if err != nil {
			return nil, err
		}
		result = nodes
	}
	if resolvedSchema.AdditionalProperties != nil && resolvedSchema.AdditionalProperties.Allows {
		nodes, err := createFieldList(resolvedSchema.AdditionalProperties.Schema, level, document, history)
		if err != nil {
			return nil, err
		}
		result = nodes
	}

	return result, nil
}

func resolveRef(refString string, document *spec3.OpenAPI) *spec.Schema {
	ref, err := jsonreference.New(refString)
	if err != nil {
		return nil
	}

	if !ref.HasFragmentOnly {
		// Downloading is not supported. Treat as not found
		return nil
	}

	fragment := ref.GetURL().Fragment
	components := strings.Split(fragment, "/")

	// components e.g. #/components/schemas/io.k8s.api.core.v1.Pod -> io.k8s.api.core.v1.Pod
	return document.Components.Schemas[components[3]]
}

func createField(name string, schema *spec.Schema, level int, document *spec3.OpenAPI) *Field {
	var result Field

	result.Name = name
	result.Level = level
	fieldSchema := schema.Properties[name]
	result.Type = typeGuess(&fieldSchema, document)
	for _, required := range schema.Required {
		if required == name {
			result.Required = true
		}
	}

	result.Enum = extractEnum(&fieldSchema)

	return &result
}

func typeGuess(schema *spec.Schema, document *spec3.OpenAPI) string {
	if schema == nil {
		return "Object"
	}
	// Array 타입
	if schema.Items != nil && schema.Items.Schema != nil {
		return "[]" + typeGuess(schema.Items.Schema, document)
	}

	// Map 타입
	if schema.AdditionalProperties != nil && schema.AdditionalProperties.Schema != nil {
		return fmt.Sprintf("map[string]%s", typeGuess(schema.AdditionalProperties.Schema, document))
	}

	// Ref 타입
	if refString := schema.Ref.String(); refString != "" {
		// ref가 있는 경우 ref된 스키마 확인
		if resolved := resolveRef(refString, document); resolved != nil {
			// ref된 스키마가 primitive type이 아닌 경우에만 ref 이름 사용
			if resolved.Type == nil || resolved.Type[0] == "object" {
				// ref 문자열에서 마지막 컴포넌트만 추출 (예: io.k8s.api.core.v1.PodTemplateSpec -> PodTemplateSpec)
				parts := strings.Split(refString, "/")
				name := parts[len(parts)-1]
				nameParts := strings.Split(name, ".")
				return nameParts[len(nameParts)-1]
			}
			return strings.Join(resolved.Type, "|")
		}
	}

	// AllOf가 하나만 있고 properties가 없는 경우
	if len(schema.AllOf) == 1 && len(schema.Properties) == 0 {
		return typeGuess(&schema.AllOf[0], document)
	}

	// 기본 타입
	if len(schema.Type) > 0 {
		if schema.Type[0] == "object" {
			return "Object"
		}
		return strings.Join(schema.Type, "|")
	}

	return "Object"
}

func extractEnum(schema *spec.Schema) []string {
	var result []string

	if schema == nil || len(schema.Enum) == 0 {
		return result
	}

	// enum 값들 순회
	for _, element := range schema.Enum {
		// 빈 문자열은 "" 로 표시
		if str, ok := element.(string); ok && str == "" {
			result = append(result, `""`)
		} else {
			result = append(result, fmt.Sprintf("%v", element))
		}
	}

	return result
}

func getDocumentPath(gvr schema.GroupVersionResource) string {
	return strings.TrimPrefix(strings.Join([]string{getPathPrefix(gvr), gvr.Version}, "/"), "/")
}

// TODO: remove if not used
// func GetClusterScopedPath(gvr schema.GroupVersionResource) string {
// 	return strings.Join([]string{GetPathPrefix(gvr), gvr.Version, gvr.Resource}, "/")
// }

// func GetClusterScopedNamePath(gvr schema.GroupVersionResource) string {
// 	return strings.Join([]string{GetPathPrefix(gvr), gvr.Version, gvr.Resource, "{name}"}, "/")
// }

// func GetNamespaceScopedPath(gvr schema.GroupVersionResource) string {
// 	return strings.Join([]string{GetPathPrefix(gvr), gvr.Version, "namespaces", "{namespace}", gvr.Resource}, "/")
// }

// func GetNamespaceScopedNamePath(gvr schema.GroupVersionResource) string {
// 	return strings.Join([]string{GetPathPrefix(gvr), gvr.Version, "namespaces", "{namespace}", gvr.Resource, "{name}"}, "/")
// }
