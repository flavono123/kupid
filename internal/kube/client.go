package kube

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

var (
	// Multi-context support
	clientSetsMu sync.RWMutex
	clientSets   = make(map[string]*kubernetes.Clientset)

	dynamicClientsMu sync.RWMutex
	dynamicClients   = make(map[string]dynamic.Interface)

	// Cache kubeconfig (singleton)
	kubeConfigOnce sync.Once
	rawConfig      *api.Config
	rawConfigErr   error
)

// getRawConfig loads and caches the kubeconfig (singleton)
func getRawConfig() (*api.Config, error) {
	kubeConfigOnce.Do(func() {
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		configOverrides := &clientcmd.ConfigOverrides{}
		kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

		cfg, err := kubeConfig.RawConfig()
		if err != nil {
			rawConfigErr = fmt.Errorf("failed to load kubeconfig: %v", err)
			return
		}
		rawConfig = &cfg
	})
	return rawConfig, rawConfigErr
}

// ListContexts returns all available context names from kubeconfig
func ListContexts() ([]string, error) {
	cfg, err := getRawConfig()
	if err != nil {
		return nil, err
	}

	contexts := make([]string, 0, len(cfg.Contexts))
	for name := range cfg.Contexts {
		contexts = append(contexts, name)
	}
	return contexts, nil
}

// GetCurrentContext returns the current active context name
func GetCurrentContext() (string, error) {
	cfg, err := getRawConfig()
	if err != nil {
		return "", err
	}
	return cfg.CurrentContext, nil
}

// CurrentContext returns the current active context name (legacy, kept for TUI compatibility)
func CurrentContext() (string, error) {
	return GetCurrentContext()
}

// DiscoveryClient returns a discovery client for the current context (legacy, kept for TUI compatibility)
func DiscoveryClient() (discovery.DiscoveryInterface, error) {
	return DiscoveryClientForContext("")
}

// DynamicClient returns a dynamic client for the current context (legacy, kept for TUI compatibility)
func DynamicClient() (dynamic.Interface, error) {
	return DynamicClientForContext("")
}

// clientSet returns a clientset for the current context (legacy, kept for TUI compatibility)
func clientSet() (*kubernetes.Clientset, error) {
	return clientSetForContext("")
}

func kubeConfig() (*rest.Config, error) {
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		return nil, fmt.Errorf("failed to get kubeconfig: %v", err)
	}
	return config, nil
}

// kubeConfigForContext creates a rest.Config for the specified context
// If contextName is empty, uses the current context
func kubeConfigForContext(contextName string) (*rest.Config, error) {
	if contextName == "" {
		return kubeConfig()
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	configOverrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextName,
	}
	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

	config, err := kubeConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config for context %s: %v", contextName, err)
	}
	return config, nil
}

// clientSetForContext returns a cached or new Clientset for the specified context
// If contextName is empty, uses the current context
func clientSetForContext(contextName string) (*kubernetes.Clientset, error) {
	if contextName == "" {
		ctx, err := GetCurrentContext()
		if err != nil {
			return nil, err
		}
		contextName = ctx
	}

	// Check cache
	clientSetsMu.RLock()
	if cs, exists := clientSets[contextName]; exists {
		clientSetsMu.RUnlock()
		return cs, nil
	}
	clientSetsMu.RUnlock()

	// Create new client
	clientSetsMu.Lock()
	defer clientSetsMu.Unlock()

	// Double-check after acquiring write lock
	if cs, exists := clientSets[contextName]; exists {
		return cs, nil
	}

	config, err := kubeConfigForContext(contextName)
	if err != nil {
		return nil, err
	}

	cs, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset for context %s: %v", contextName, err)
	}

	clientSets[contextName] = cs
	return cs, nil
}

// DynamicClientForContext returns a cached or new dynamic client for the specified context
// If contextName is empty, uses the current context
func DynamicClientForContext(contextName string) (dynamic.Interface, error) {
	if contextName == "" {
		ctx, err := GetCurrentContext()
		if err != nil {
			return nil, err
		}
		contextName = ctx
	}

	// Check cache
	dynamicClientsMu.RLock()
	if dc, exists := dynamicClients[contextName]; exists {
		dynamicClientsMu.RUnlock()
		return dc, nil
	}
	dynamicClientsMu.RUnlock()

	// Create new client
	dynamicClientsMu.Lock()
	defer dynamicClientsMu.Unlock()

	// Double-check after acquiring write lock
	if dc, exists := dynamicClients[contextName]; exists {
		return dc, nil
	}

	config, err := kubeConfigForContext(contextName)
	if err != nil {
		return nil, err
	}

	dc, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client for context %s: %v", contextName, err)
	}

	dynamicClients[contextName] = dc
	return dc, nil
}

// DiscoveryClientForContext returns a discovery client for the specified context
// If contextName is empty, uses the current context
func DiscoveryClientForContext(contextName string) (discovery.DiscoveryInterface, error) {
	cs, err := clientSetForContext(contextName)
	if err != nil {
		return nil, err
	}
	return cs.Discovery(), nil
}
