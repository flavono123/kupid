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

type Property struct {
	Name string
	Path string
	// Default  string
	Types    []string
	Children map[string]*Property
}

type PropertyBuilder struct {
	property *Property
}

func CreateProperty(name string) *PropertyBuilder {
	return &PropertyBuilder{
		property: &Property{
			Name:     name,
			Children: make(map[string]*Property),
		},
	}
}

func (b *PropertyBuilder) WithPath(path string) *PropertyBuilder {
	b.property.Path = path
	return b
}

func (b *PropertyBuilder) WithTypes(types []string) *PropertyBuilder {
	b.property.Types = types
	return b
}

func (b *PropertyBuilder) WithChildren(children map[string]*Property) *PropertyBuilder {
	b.property.Children = children
	return b
}

func (b *PropertyBuilder) WithNestedTypeChildren(nestedType string) *PropertyBuilder {
	b.property.Children = map[string]*Property{
		"*": CreateProperty("*").WithTypes([]string{nestedType}).Build(),
	}
	return b
}

func (b *PropertyBuilder) Build() *Property {
	return b.property
}

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

	schema, hasSchema := schemas[schemaKey].(map[string]interface{})
	if !hasSchema {
		return nil, fmt.Errorf("schema not found: %s", schemaKey)
	}

	properties, hasProperties := schema["properties"].(map[string]interface{})
	// schema but no properties
	// e.g. io.k8s.apimachinery.pkg.apis.meta.v1.Time
	if !hasProperties {
		schemaType, err := getSchemaTypes(schema, schemaKey)
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

		propertyType, hasType := property["type"].(string)
		if !hasType { // top level object properties such as spec, status and metadata does not have a type
			nextSchemaKey, err := getAllOfSchemaKey(property)
			if err != nil {
				return nil, err
			}

			children, err := getSchemaProperties(schemas, nextSchemaKey)
			if err != nil {
				return nil, err
			}

			result[key] = CreateProperty(key).WithTypes([]string{fmt.Sprintf("object<%s>", nextSchemaKey)}).WithChildren(children).Build()
		} else {
			switch propertyType {
			case "object":
				additionalProperties, hasAdditionalProperties := property["additionalProperties"].(map[string]interface{})
				if !hasAdditionalProperties {
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
					result[key] = CreateProperty(key).
						WithTypes(types).
						WithChildren(children).
						Build()
				} else if hasApType {
					result[key] = CreateProperty(key).
						WithTypes([]string{"object"}).
						WithNestedTypeChildren(apType).
						Build()
				}
			case "array":
				items := property["items"].(map[string]interface{})
				itemsSchemaKey, err := getAllOfSchemaKey(items)
				if err != nil { // no allOf
					return nil, err
				}

				children, err := getSchemaProperties(schemas, itemsSchemaKey)
				if err != nil {
					return nil, err
				}

				result[key] = CreateProperty(key).
					WithTypes([]string{fmt.Sprintf("array<%s>", itemsSchemaKey)}).
					WithChildren(children).
					Build()

			default:
				result[key] = CreateProperty(key).WithTypes([]string{propertyType}).Build()
			}
		}
	}

	return result, nil
}

func getSchemaTypes(schemaOrItems map[string]interface{}, key string) ([]string, error) {
	var result []string
	schemaType, hasType := schemaOrItems["type"].(string)
	oneOf, hasOneOf := schemaOrItems["oneOf"].([]interface{})

	if hasType == hasOneOf { // !xor
		return nil, fmt.Errorf("no type or oneOf found or both are present: %s", key)
	}

	if hasType {
		result = append(result, schemaType)
	} else if hasOneOf {
		result = getSchemaTypesFromOneOf(oneOf)
	}

	return result, nil
}

func getSchemaTypesFromOneOf(oneOf []interface{}) []string {
	var result []string
	for _, obj := range oneOf {
		oneOfType := obj.(map[string]interface{})["type"].(string)
		result = append(result, oneOfType)
	}
	return result
}

// return the key of another schema from allOf[0].$ref
// object is one of schema, property or item
func getAllOfSchemaKey(object map[string]interface{}) (string, error) {
	var result string
	allOf, ok := object["allOf"].([]interface{})
	if !ok {
		return "", fmt.Errorf("no allOf found")
	}
	result, err := getSchemaKeyFromRef(allOf)
	if err != nil {
		return "", err
	}

	return result, nil
}

func getSchemaKeyFromRef(allOf []interface{}) (string, error) {
	var result string

	// parse from the first
	ref, hasRef := allOf[0].(map[string]interface{})["$ref"].(string)
	if !hasRef {
		return "", fmt.Errorf("no $ref found")
	}
	result = getSchemaKey(ref)
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
