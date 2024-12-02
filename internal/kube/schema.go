package kube

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/flavono123/kupid/internal/property"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func GetNodes(resourceKey string) (map[string]*property.Node, error) {
	var result map[string]*property.Node
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %v", err)
	}
	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %v", err)
	}
	discoveryClient := client.Discovery()
	openapi := discoveryClient.OpenAPIV3()

	paths, err := openapi.Paths()
	if err != nil {
		return nil, fmt.Errorf("failed to get openapi paths: %v", err)
	}

	// TODO: extend to other api groups
	schema, err := paths["api/v1"].Schema("application/json")
	if err != nil {
		return nil, fmt.Errorf("failed to get openapi schema: %v", err)
	}

	var openAPI *spec3.OpenAPI

	err = json.Unmarshal(schema, &openAPI)
	if err != nil {
		log.Fatalf("failed to unmarshal openapi: %v", err)
	}

	nodes, err := getSchemaPropertyNodes(openAPI.Components.Schemas, resourceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get schema properties: %v", err)
	}

	result = nodes
	return result, nil
}

func getSchemaPropertyNodes(schemas map[string]*spec.Schema, schemaKey string) (map[string]*property.Node, error) {
	var result = map[string]*property.Node{}

	schema, exists := schemas[schemaKey]
	if !exists {
		return nil, fmt.Errorf("schema not found: %s", schemaKey)
	}

	// schema but no properties
	if !property.HasProperties(&schema.SchemaProps) {
		result["*"] = property.CreatePropertyNodeBuilder(&schema.SchemaProps).
			Build()
		return result, nil
	}

	for key, propSchema := range schema.SchemaProps.Properties {
		if key == "apiVersion" || key == "kind" || key == "metadata" {
			continue
		}

		propNode, err := processPropertyNode(schemas, &propSchema.SchemaProps)
		if err != nil {
			return nil, err
		}
		result[key] = propNode
	}

	return result, nil
}

func processPropertyNode(schemas map[string]*spec.Schema, schemaProps *spec.SchemaProps) (*property.Node, error) {
	var result *property.Node

	if !property.HasType(schemaProps) {
		// top level schema props; should have ref in allOf
		refKey := property.GetRefKey(schemaProps)
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = property.CreatePropertyNodeBuilder(schemaProps).
			WithNestedRefKey(refKey).
			WithChildren(children).
			Build()
		return result, nil
	}

	var err error
	switch property.GetType(schemaProps) {
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
		result = property.CreatePropertyNodeBuilder(schemaProps).
			WithPropType(property.GetType(schemaProps)).
			Build()
	}

	return result, nil
}

func processObjectPropertyNode(schemas map[string]*spec.Schema, prop *spec.SchemaProps) (*property.Node, error) {
	var result *property.Node

	refKey := property.GetRefKey(&prop.AdditionalProperties.Schema.SchemaProps)
	if refKey != "" {
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = property.CreatePropertyNodeBuilder(prop).
			WithChildren(children).
			Build()
	} else {
		result = property.CreatePropertyNodeBuilder(prop).
			WithNestedType(property.GetType(&prop.AdditionalProperties.Schema.SchemaProps)).
			WithNestedTypeChildren(&prop.AdditionalProperties.Schema.SchemaProps).
			Build()
	}

	return result, nil
}

func processArrayPropertyNode(schemas map[string]*spec.Schema, prop *spec.SchemaProps) (*property.Node, error) {
	var result *property.Node

	items := prop.Items

	if property.HasType(&items.Schema.SchemaProps) {
		nestedType := property.GetType(&items.Schema.SchemaProps)
		result = property.CreatePropertyNodeBuilder(prop).
			WithNestedType(nestedType).
			Build()
	} else { // ref; expandable
		refKey := property.GetRefKey(&items.Schema.SchemaProps)
		children, err := getSchemaPropertyNodes(schemas, refKey)
		if err != nil {
			return nil, err
		}
		result = property.CreatePropertyNodeBuilder(prop).
			WithNestedRefKey(refKey).
			WithChildren(children).
			Build()
	}
	return result, nil
}
