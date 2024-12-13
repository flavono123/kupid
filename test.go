package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	v2 "github.com/flavono123/kupid/internal/kube/v2"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kube-openapi/pkg/spec3"
)

func main() {
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		panic(fmt.Errorf("failed to get in-cluster config: %v", err))
	}
	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(fmt.Errorf("failed to create client: %v", err))
	}
	discoveryClient := client.Discovery()
	openapiv3 := discoveryClient.OpenAPIV3()
	paths, err := openapiv3.Paths()
	if err != nil {
		panic(fmt.Errorf("failed to get openapi paths: %v", err))
	}
	gvPath := "apis/karpenter.sh/v1"
	schemabytes, err := paths[gvPath].Schema(runtime.ContentTypeJSON)
	if err != nil {
		panic(fmt.Errorf("failed to get openapi schema: %v", err))
	}
	var document *spec3.OpenAPI
	if err := json.Unmarshal(schemabytes, &document); err != nil {
		panic(fmt.Errorf("failed to unmarshal schema: %v", err))
	}
	// podSchema := schema.Components.Schemas["io.k8s.api.core.v1.Pod"]

	// FindGVK
	resource := "nodepools"
	resourcePath := fmt.Sprintf("/%s/%s", gvPath, resource)
	gvk := v2.FindGVK(document, []string{resourcePath})
	fmt.Println(gvk)

	schema, err := v2.FindSchemaByGVK(document, *gvk)
	if err != nil {
		panic(fmt.Errorf("failed to find schema: %v", err))
	}
	// fmt.Println(schema.Description)
	history := make(map[string]bool)
	nodes, err := v2.CreateResourceFields(schema, document, history)
	if err != nil {
		panic(fmt.Errorf("failed to output schema: %v", err))
	}

	delete(nodes, "apiVersion")
	delete(nodes, "kind")
	delete(nodes, "metadata")
	fmt.Println(nodes)
}
