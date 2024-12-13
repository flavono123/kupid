package kube

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

func GetGVKs() ([]schema.GroupVersionKind, error) {
	var result []schema.GroupVersionKind

	discoveryClient, err := DiscoveryClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get discovery client: %v", err)
	}

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
