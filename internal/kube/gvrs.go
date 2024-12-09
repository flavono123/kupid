package kube

import (
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

func GetGVKs() ([]schema.GroupVersionKind, error) {
	var result []schema.GroupVersionKind

	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %v", err)
	}
	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %v", err)
	}
	discoveryClient := client.Discovery()

	apiResourceList, err := discoveryClient.ServerPreferredResources()
	if err != nil {
		return nil, fmt.Errorf("failed to get server preferred resources: %v", err)
	}

	for _, apiResource := range apiResourceList {
		for _, r := range apiResource.APIResources {
			gv, err := schema.ParseGroupVersion(apiResource.GroupVersion)
			if err != nil {
				return nil, fmt.Errorf("failed to parse group version: %v", err)
			}
			gvk := gv.WithKind(r.Kind)
			result = append(result, gvk)
		}
	}
	return result, nil
}
