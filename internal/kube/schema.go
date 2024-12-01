package kube

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func GetSchema(resourceKey string) {
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		log.Fatalf("failed to get in-cluster config: %v", err)
	}
	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	discoveryClient := client.Discovery()
	openapi := discoveryClient.OpenAPIV3()

	fmt.Printf("\n=== OpenAPI Definitions ===\n")
	paths, err := openapi.Paths()
	if err != nil {
		log.Fatalf("failed to get openapi paths: %v", err)
	}

	// TODO: extend to other api groups
	schema, err := paths["api/v1"].Schema("application/json")
	if err != nil {
		log.Fatalf("failed to get openapi schema: %v", err)
	}

	var openAPI *spec3.OpenAPI

	err = json.Unmarshal(schema, &openAPI)
	if err != nil {
		log.Fatalf("failed to unmarshal openapi: %v", err)
	}

	nodes, err := getSchemaPropertyNodes(openAPI.Components.Schemas, resourceKey)
	if err != nil {
		log.Fatalf("failed to get schema properties: %v", err)
	}
	printPropertyNodes(nodes, 0)
}

func printPropertyNodes(nodes map[string]*PropertyNode, indent int) {
	keys := []string{}
	for key := range nodes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		node := nodes[key]
		displayType := strings.Join(GetType(node.SchemaProps), "|")
		if len(displayType) == 0 {
			displayType = GetRefKey(node.SchemaProps)
		}
		fmt.Printf("%s(%s)\n", strings.Repeat(" ", indent*2)+key, displayType)
		if node.Children != nil {
			printPropertyNodes(node.Children, indent+1)
		}
	}
}

func getSchemaPropertyNodes(schemas map[string]*spec.Schema, schemaKey string) (map[string]*PropertyNode, error) {
	var result = map[string]*PropertyNode{}

	schema, exists := schemas[schemaKey]
	if !exists {
		return nil, fmt.Errorf("schema not found: %s", schemaKey)
	}

	node := CreatePropertyNodeBuilder(&schema.SchemaProps).Build()

	// schema but no properties
	if !node.HasProperties() {
		result["*"] = node
		return result, nil
	}

	for key, propSchema := range node.SchemaProps.Properties {
		if key == "apiVersion" || key == "kind" || key == "metadata" {
			continue
		}

		propNode, err := processPropertyNode(schemas, &propSchema.SchemaProps, key)
		if err != nil {
			return nil, err
		}
		result[key] = propNode
	}

	return result, nil
}

func processPropertyNode(schemas map[string]*spec.Schema, schemaProps *spec.SchemaProps, key string) (*PropertyNode, error) {
	var result *PropertyNode

	if !HasType(schemaProps) {
		// top level schema props; should have ref in allOf
		refKey := GetRefKey(schemaProps)
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = CreatePropertyNodeBuilder(schemaProps).WithChildren(children).Build()
		return result, nil
	}

	var err error
	switch Type(schemaProps) {
	case "object":
		result, err = processObjectPropertyNode(schemas, schemaProps)
		if err != nil {
			return nil, err
		}
	case "array":
		result, err = processArrayPropertyNode(schemas, schemaProps)
		if err != nil {
			return nil, err
		}
	default:
		result = CreatePropertyNodeBuilder(schemaProps).Build()
	}

	return result, nil
}

func processObjectPropertyNode(schemas map[string]*spec.Schema, prop *spec.SchemaProps) (*PropertyNode, error) {
	var result *PropertyNode

	refKey := GetRefKey(&prop.AdditionalProperties.Schema.SchemaProps)
	if refKey != "" {
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = CreatePropertyNodeBuilder(prop).
			WithChildren(children).
			Build()
	} else {
		result = CreatePropertyNodeBuilder(prop).
			WithNestedTypeChildren(&prop.AdditionalProperties.Schema.SchemaProps).
			Build()
	}

	return result, nil
}

func processArrayPropertyNode(schemas map[string]*spec.Schema, prop *spec.SchemaProps) (*PropertyNode, error) {
	var result *PropertyNode

	items := prop.Items

	if HasType(&items.Schema.SchemaProps) {
		result = CreatePropertyNodeBuilder(&items.Schema.SchemaProps).Build()
	} else { // ref
		refKey := GetRefKey(&items.Schema.SchemaProps)
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = CreatePropertyNodeBuilder(&items.Schema.SchemaProps).
			WithChildren(children).
			Build()
	}
	return result, nil
}
