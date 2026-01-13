package kube

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/restmapper"
)

// GVKInfo contains GVK information along with short names for search
type GVKInfo struct {
	schema.GroupVersionKind
	ShortNames []string
}

// GetGVKs returns all available GVKs from the current context (legacy, kept for TUI compatibility)
func GetGVKs() ([]schema.GroupVersionKind, error) {
	return GetGVKsForContext("")
}

// GetGVKsForContext returns all available GVKs from the specified context
// If contextName is empty, uses the current context
func GetGVKsForContext(contextName string) ([]schema.GroupVersionKind, error) {
	infos, err := GetGVKInfosForContext(contextName)
	if err != nil {
		return nil, err
	}
	result := make([]schema.GroupVersionKind, len(infos))
	for i, info := range infos {
		result[i] = info.GroupVersionKind
	}
	return result, nil
}

// GetGVKInfosForContext returns all available GVK infos (including short names) from the specified context
// If contextName is empty, uses the current context
func GetGVKInfosForContext(contextName string) ([]GVKInfo, error) {
	var result []GVKInfo

	discoveryClient, err := DiscoveryClientForContext(contextName)
	if err != nil {
		return nil, fmt.Errorf("failed to get discovery client: %w", err)
	}

	apiResourceList, err := discoveryClient.ServerPreferredResources()
	if err != nil {
		return nil, fmt.Errorf("failed to get server preferred resources: %w", err)
	}

	for _, apiResource := range apiResourceList {
		for _, r := range apiResource.APIResources {
			// Filter: only include resources that support "list" verb
			// This excludes internal resources like Binding that only support "create"
			if !supportsVerb(r.Verbs, "list") {
				continue
			}

			gv, err := schema.ParseGroupVersion(apiResource.GroupVersion)
			if err != nil {
				return nil, fmt.Errorf("failed to parse group version: %w", err)
			}
			info := GVKInfo{
				GroupVersionKind: gv.WithKind(r.Kind),
				ShortNames:       r.ShortNames,
			}
			result = append(result, info)
		}
	}
	return result, nil
}

// GetGVR converts a GVK to GVR using the current context (legacy, kept for TUI compatibility)
func GetGVR(gvk schema.GroupVersionKind) (schema.GroupVersionResource, error) {
	return GetGVRForContext("", gvk)
}

// GetGVRForContext converts a GVK to GVR using the specified context
// If contextName is empty, uses the current context
func GetGVRForContext(contextName string, gvk schema.GroupVersionKind) (schema.GroupVersionResource, error) {
	discoveryClient, err := DiscoveryClientForContext(contextName)
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("failed to get discovery client: %w", err)
	}
	groupResources, err := restmapper.GetAPIGroupResources(discoveryClient)
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("failed to get API group resources: %w", err)
	}

	mapper := restmapper.NewDiscoveryRESTMapper(groupResources)
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("failed to get REST mapping for %s: %w", gvk.String(), err)
	}

	return mapping.Resource, nil
}

// supportsVerb checks if a verb is in the list of supported verbs
func supportsVerb(verbs []string, verb string) bool {
	for _, v := range verbs {
		if v == verb {
			return true
		}
	}
	return false
}
