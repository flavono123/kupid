package kube

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
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
			rawConfigErr = fmt.Errorf("failed to load kubeconfig: %w", err)
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

func kubeConfig() (*rest.Config, error) {
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		return nil, fmt.Errorf("failed to get kubeconfig: %w", err)
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
		return nil, fmt.Errorf("failed to get config for context %s: %w", contextName, err)
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
		return nil, fmt.Errorf("failed to create clientset for context %s: %w", contextName, err)
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
		return nil, fmt.Errorf("failed to create dynamic client for context %s: %w", contextName, err)
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

// RESTClientForContext returns a REST client for the specified context and GVR
// If contextName is empty, uses the current context
func RESTClientForContext(contextName string, gvr schema.GroupVersionResource) (rest.Interface, error) {
	cs, err := clientSetForContext(contextName)
	if err != nil {
		return nil, err
	}

	// Return appropriate REST client based on group
	switch gvr.Group {
	case "":
		return cs.CoreV1().RESTClient(), nil
	case "apps":
		return cs.AppsV1().RESTClient(), nil
	case "batch":
		return cs.BatchV1().RESTClient(), nil
	case "networking.k8s.io":
		return cs.NetworkingV1().RESTClient(), nil
	case "storage.k8s.io":
		return cs.StorageV1().RESTClient(), nil
	case "rbac.authorization.k8s.io":
		return cs.RbacV1().RESTClient(), nil
	case "autoscaling":
		return cs.AutoscalingV1().RESTClient(), nil
	case "policy":
		return cs.PolicyV1().RESTClient(), nil
	case "coordination.k8s.io":
		return cs.CoordinationV1().RESTClient(), nil
	case "scheduling.k8s.io":
		return cs.SchedulingV1().RESTClient(), nil
	case "admissionregistration.k8s.io":
		return cs.AdmissionregistrationV1().RESTClient(), nil
	case "apiextensions.k8s.io":
		// For CRDs, we need to use the discovery or dynamic client
		return nil, fmt.Errorf("apiextensions.k8s.io not supported via REST client")
	default:
		// For unknown groups, return core v1 as fallback
		return cs.CoreV1().RESTClient(), nil
	}
}

// TryTshKubeLogin attempts to run tsh kube login for a context
// Returns true if login was attempted (regardless of success), false if context doesn't use tsh
func TryTshKubeLogin(contextName string) (bool, error) {
	cfg, err := getRawConfig()
	if err != nil {
		return false, err
	}

	// Get context
	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		return false, fmt.Errorf("context %s not found", contextName)
	}

	// Get auth info (user)
	authInfo, exists := cfg.AuthInfos[ctx.AuthInfo]
	if !exists {
		return false, fmt.Errorf("auth info %s not found for context %s", ctx.AuthInfo, contextName)
	}

	// Check if using exec with tsh
	if authInfo.Exec == nil || !strings.Contains(authInfo.Exec.Command, "tsh") {
		return false, nil // Not using tsh, no need to login
	}

	// Convert "tsh kube credentials ..." to "tsh kube login"

	cmd := exec.Command("tsh", "login")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	err = cmd.Run()
	if err != nil {
		return true, fmt.Errorf("tsh kube login failed: %w", err)
	}

	return true, nil
}

// InvalidateClientCache removes cached clients for a context
// This is needed after tsh kube login to force recreation of clients
func InvalidateClientCache(contextName string) {
	clientSetsMu.Lock()
	delete(clientSets, contextName)
	clientSetsMu.Unlock()

	dynamicClientsMu.Lock()
	delete(dynamicClients, contextName)
	dynamicClientsMu.Unlock()
}

// InvalidateKubeconfigCache clears the cached kubeconfig
// This forces a reload from disk on the next call to getRawConfig
func InvalidateKubeconfigCache() {
	// Reset sync.Once to allow re-execution
	kubeConfigOnce = sync.Once{}
	rawConfig = nil
	rawConfigErr = nil

	// Also clear all client caches since they're based on the old config
	clientSetsMu.Lock()
	clientSets = make(map[string]*kubernetes.Clientset)
	clientSetsMu.Unlock()

	dynamicClientsMu.Lock()
	dynamicClients = make(map[string]dynamic.Interface)
	dynamicClientsMu.Unlock()
}
