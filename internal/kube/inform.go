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
)

func ListEverySchemaInCluster() {
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

	var openAPISchema map[string]interface{}
	err = json.Unmarshal(schema, &openAPISchema)
	if err != nil {
		log.Fatalf("failed to unmarshal openapi schema: %v", err)
	}

	schemas := openAPISchema["components"].(map[string]interface{})["schemas"].(map[string]interface{})

	properties, err := getSchemaProperties(schemas, "io.k8s.api.core.v1.Pod")
	if err != nil {
		log.Fatalf("failed to get schema properties: %v", err)
	}
	printSchemaProperties(properties, 0)
}

func getSchemaProperties(schemas map[string]interface{}, schemaKey string) (map[string]*Property, error) {
	var result = map[string]*Property{}

	schema, exists := schemas[schemaKey].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("schema not found: %s", schemaKey)
	}

	properties, exists := schema["properties"].(map[string]interface{})
	// schema but no properties
	// e.g. io.k8s.apimachinery.pkg.apis.meta.v1.Time
	if !exists {
		schemaType, err := getTypes(schema, schemaKey)
		if err != nil {
			return nil, err
		}
		result["*"] = CreateProperty("*").WithTypes(schemaType).Build()
		return result, nil
	}

	for key, p := range properties {
		if key == "apiVersion" || key == "kind" || key == "metadata" { // dont care about metadata for now
			continue
		}

		property := p.(map[string]interface{})
		schemaProperty, err := processProperty(schemas, key, property)
		if err != nil {
			return nil, err
		}
		result[key] = schemaProperty
	}

	return result, nil
}

func processProperty(schemas map[string]interface{}, key string, property map[string]interface{}) (*Property, error) {
	var result *Property

	propertyType, exists := property["type"].(string)
	if !exists { // top level schema object such as spec, status and metadata does not have a type
		schemaAllOf, ok := property["allOf"].([]interface{})
		if !ok {
			return nil, fmt.Errorf("no allOf found")
		}

		schemaProperty, err := processSchema(schemas, key, schemaAllOf)
		if err != nil {
			return nil, err
		}
		result = schemaProperty
		return result, nil
	}

	var err error

	switch propertyType {
	case "object":
		result, err = processObjectProperty(schemas, key, property)
		if err != nil {
			return nil, err
		}
	case "array":
		result, err = processArrayProperty(schemas, key, property)
		if err != nil {
			return nil, err
		}
	default:
		result = CreateProperty(key).
			WithTypes([]string{propertyType}).
			Build()
	}

	return result, nil
}

func processSchema(schemas map[string]interface{}, key string, schemaAllOf []interface{}) (*Property, error) {
	var result *Property

	ref, exists := schemaAllOf[0].(map[string]interface{})["$ref"].(string)
	if !exists {
		return nil, fmt.Errorf("no $ref found in allOf[0] of %s", key)
	}

	schemaKey := getSchemaKey(ref)
	children, err := getSchemaProperties(schemas, schemaKey)
	if err != nil {
		return nil, err
	}
	result = CreateProperty(key).
		WithTypes([]string{fmt.Sprintf("object<%s>", schemaKey)}).
		WithChildren(children).
		Build()

	return result, nil
}

func processObjectProperty(schemas map[string]interface{}, key string, property map[string]interface{}) (*Property, error) {
	var result *Property

	additionalProperties, exists := property["additionalProperties"].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("no additionalProperties found: %s", key)
	}

	ref, hasRef := additionalProperties["$ref"]
	apType, hasApType := additionalProperties["type"].(string)

	if hasRef == hasApType { // !xor
		return nil, fmt.Errorf("no ref or type found or both are present: %s", key)
	}

	if hasRef {
		schemaKey := getSchemaKey(ref.(string))
		children, err := getSchemaProperties(schemas, schemaKey)
		if err != nil {
			return nil, err
		}
		types := []string{fmt.Sprintf("object<%s>", schemaKey)}
		result = CreateProperty(key).
			WithTypes(types).
			WithChildren(children).
			Build()
	} else if hasApType {
		result = CreateProperty(key).
			WithTypes([]string{"object"}).
			WithNestedTypeChildren(apType).
			Build()
	}

	return result, nil
}

func processArrayProperty(schemas map[string]interface{}, key string, property map[string]interface{}) (*Property, error) {
	var result *Property

	items := property["items"].(map[string]interface{})
	itemsTypes, err := getTypes(items, key)
	if err != nil { // no types
		allOf, exists := items["allOf"].([]interface{})
		if !exists {
			return nil, fmt.Errorf("no allOf found in items of %s", key)
		}
		ref, exists := allOf[0].(map[string]interface{})["$ref"].(string)
		if !exists {
			return nil, fmt.Errorf("no $ref found in allOf[0] of items of %s", key)
		}
		itemsSchemaKey := getSchemaKey(ref)
		children, err := getSchemaProperties(schemas, itemsSchemaKey)
		if err != nil {
			return nil, err
		}

		result = CreateProperty(key).
			WithTypes([]string{fmt.Sprintf("array<%s>", itemsSchemaKey)}).
			WithChildren(children).
			Build()
	} else {
		result = CreateProperty(key).
			WithTypes(itemsTypes).
			Build()
	}

	return result, nil
}

func getTypes(schemaOrItems map[string]interface{}, key string) ([]string, error) {
	var result []string

	schemaType, hasType := schemaOrItems["type"].(string)
	oneOf, hasOneOf := schemaOrItems["oneOf"].([]interface{})

	if hasType == hasOneOf { // !xor
		return nil, fmt.Errorf("no type or oneOf found or both are present: %s", key)
	}

	if hasType {
		result = append(result, schemaType)
	} else if hasOneOf {
		for _, obj := range oneOf {
			oneOfType := obj.(map[string]interface{})["type"].(string)
			result = append(result, oneOfType)
		}
	}

	return result, nil
}

func getSchemaKey(ref string) string {
	// "#/components/schemas/<schema.key>"
	splitted := strings.Split(ref, "/")
	return splitted[len(splitted)-1]
}

// for debugging
func printSchemaProperties(properties map[string]*Property, indent int) {
	keys := []string{}
	for key := range properties {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		property := properties[key]
		fmt.Printf("%s(%s)\n", strings.Repeat(" ", indent*2)+property.Name, strings.Join(property.Types, "|"))
		if property.Children != nil {
			printSchemaProperties(property.Children, indent+1)
		}
	}
}
