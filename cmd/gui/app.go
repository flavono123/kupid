package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/store"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// App struct
type App struct {
	ctx           context.Context
	favoriteStore *store.Store
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Detect dev mode from wails environment
	env := runtime.Environment(ctx)
	devMode := env.BuildType == "dev"

	s, err := store.NewStore(store.StoreOptions{DevMode: devMode})
	if err != nil {
		log.Printf("failed to create favorite store: %v", err)
	} else {
		a.favoriteStore = s
		if err := a.favoriteStore.Load(); err != nil {
			log.Printf("failed to load favorite views: %v", err)
		}
		log.Printf("favorite store initialized (dev=%v)", devMode)
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ListContexts returns all available Kubernetes contexts
func (a *App) ListContexts() ([]string, error) {
	return kube.ListContexts()
}

// RefreshContexts invalidates the kubeconfig cache and reloads contexts
func (a *App) RefreshContexts() ([]string, error) {
	kube.InvalidateKubeconfigCache()
	return kube.ListContexts()
}

// GetCurrentContext returns the current active Kubernetes context
func (a *App) GetCurrentContext() (string, error) {
	return kube.GetCurrentContext()
}

// ContextConnectionResult represents the result of connecting to a context
type ContextConnectionResult struct {
	Context string `json:"context"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// ConnectToContexts attempts to create clients for the specified contexts
// Returns a list of results indicating success or failure for each context
func (a *App) ConnectToContexts(contexts []string) []ContextConnectionResult {
	results := make([]ContextConnectionResult, 0, len(contexts))

	for _, contextName := range contexts {
		result := ContextConnectionResult{
			Context: contextName,
			Success: false,
		}

		// Try to create a client for this context
		// This validates the context and ensures we can connect
		discoveryClient, err := kube.DiscoveryClientForContext(contextName)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		// Actually verify authentication by making a lightweight API call
		_, err = discoveryClient.ServerVersion()
		if err != nil {
			// Check if error is related to tsh authentication
			if strings.Contains(err.Error(), "tsh") {
				// Try tsh kube login
				attempted, loginErr := kube.TryTshKubeLogin(contextName)
				if attempted {
					if loginErr != nil {
						result.Error = fmt.Sprintf("tsh kube login failed: %v", loginErr)
						results = append(results, result)
						continue
					}

					// Login succeeded, invalidate cache and retry
					kube.InvalidateClientCache(contextName)

					// Recreate client and retry
					discoveryClient, err = kube.DiscoveryClientForContext(contextName)
					if err != nil {
						result.Error = err.Error()
						results = append(results, result)
						continue
					}

					_, err = discoveryClient.ServerVersion()
					if err != nil {
						result.Error = err.Error()
						results = append(results, result)
						continue
					}

					// Success after retry
					result.Success = true
					results = append(results, result)
					continue
				}
			}

			// Original error (not relogin or not using tsh)
			result.Error = err.Error()
		} else {
			result.Success = true
		}

		results = append(results, result)
	}

	return results
}

// MultiClusterGVK represents a Kubernetes resource (Group/Version/Kind) with context availability
type MultiClusterGVK struct {
	Group    string   `json:"group"`
	Version  string   `json:"version"`
	Kind     string   `json:"kind"`
	Contexts []string `json:"contexts"` // Contexts where this GVK is available
	AllCount int      `json:"allCount"` // Total number of contexts
}

// GetGVKs retrieves all unique GVKs from the specified contexts
// Returns a merged and deduplicated list of GVKs with context availability info
func (a *App) GetGVKs(contexts []string) []MultiClusterGVK {
	// Map to track unique GVKs: key = "group/version/kind"
	resourceMap := make(map[string]*MultiClusterGVK)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Process contexts in parallel
	for _, contextName := range contexts {
		wg.Add(1)
		go func(ctx string) {
			defer wg.Done()

			gvks, err := kube.GetGVKsForContext(ctx)
			if err != nil {
				// Skip contexts that fail
				return
			}

			for _, gvk := range gvks {
				// Create unique key using GVK (no GVR conversion needed)
				key := fmt.Sprintf("%s/%s/%s", gvk.Group, gvk.Version, gvk.Kind)

				// Thread-safe map update
				mu.Lock()
				if info, exists := resourceMap[key]; exists {
					// Add context to existing GVK
					info.Contexts = append(info.Contexts, ctx)
				} else {
					// Create new GVK entry
					resourceMap[key] = &MultiClusterGVK{
						Group:    gvk.Group,
						Version:  gvk.Version,
						Kind:     gvk.Kind,
						Contexts: []string{ctx},
						AllCount: len(contexts),
					}
				}
				mu.Unlock()
			}
		}(contextName)
	}

	// Wait for all goroutines to complete
	wg.Wait()

	// Convert map to slice
	results := make([]MultiClusterGVK, 0, len(resourceMap))
	for _, info := range resourceMap {
		results = append(results, *info)
	}

	return results
}

// TreeNode represents a node in the navigation tree (frontend format)
type TreeNode struct {
	Name     string      `json:"name"`
	Type     string      `json:"type"`     // e.g., "string", "[]Pod", "map[string]"
	FullPath []string    `json:"fullPath"` // for selection/search
	Level    int         `json:"level"`
	Children []*TreeNode `json:"children"`
	// Note: Expanded and Selected state are managed in the frontend
}

// GetNodeTree retrieves the node tree for a given GVK and contexts
// Returns a tree structure representing the schema + actual data
func (a *App) GetNodeTree(gvk MultiClusterGVK, contexts []string) ([]*TreeNode, error) {
	// Convert MultiClusterGVK to schema.GroupVersionKind
	schemaGVK := schema.GroupVersionKind{
		Group:   gvk.Group,
		Version: gvk.Version,
		Kind:    gvk.Kind,
	}

	// 1. Get field tree from schema (use first available context from GVK)
	var fields map[string]*kube.Field
	var err error
	if len(gvk.Contexts) > 0 {
		// Use the first context where this GVK is available
		fields, err = kube.CreateFieldTreeForContext(gvk.Contexts[0], schemaGVK)
	} else {
		fields, err = kube.CreateFieldTree(schemaGVK)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create field tree: %w", err)
	}

	// 2. Get resources from all contexts
	objs, err := getResourcesForContexts(schemaGVK, contexts)
	if err != nil {
		return nil, fmt.Errorf("failed to get resources: %w", err)
	}

	// 3. Create node tree
	nodes := kube.CreateNodeTree(fields, objs, []string{})

	// 4. Convert to frontend format (remove UI state, convert to array)
	return convertNodeTree(nodes), nil
}

// getResourcesForContexts retrieves resources from multiple contexts
func getResourcesForContexts(gvk schema.GroupVersionKind, contexts []string) ([]*unstructured.Unstructured, error) {
	var allObjs []*unstructured.Unstructured
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, contextName := range contexts {
		wg.Add(1)
		go func(ctx string) {
			defer wg.Done()

			// Get GVR from GVK
			gvr, err := kube.GetGVRForContext(ctx, gvk)
			if err != nil {
				log.Printf("Warning: failed to get GVR for %s in context %s: %v", gvk.Kind, ctx, err)
				return
			}

			// Create resource controller for this context
			controller := kube.NewResourceControllerForContext(ctx, gvr)

			// Start the informer
			_, err = controller.Inform()
			if err != nil {
				// Some resources (like Binding) may not support list operations
				// Log the error but don't fail the entire request
				log.Printf("Warning: failed to start informer for %s in context %s: %v", gvk.Kind, ctx, err)
				// Return empty object list for this context
				return
			}

			// Get objects from controller
			objs := controller.Objects()

			mu.Lock()
			allObjs = append(allObjs, objs...)
			mu.Unlock()
		}(contextName)
	}

	wg.Wait()

	// Note: We no longer fail the entire request if some contexts fail to start informers
	// Individual context errors are logged as warnings instead

	return allObjs, nil
}

// GetResources fetches actual resource data for the given GVK and contexts
// Returns raw resource data as map[string]interface{} for flexible frontend consumption
// Adds _context field to each resource to indicate which context it came from
func (a *App) GetResources(gvk MultiClusterGVK, contexts []string) ([]map[string]interface{}, error) {
	// Convert MultiClusterGVK to schema.GroupVersionKind
	schemaGVK := schema.GroupVersionKind{
		Group:   gvk.Group,
		Version: gvk.Version,
		Kind:    gvk.Kind,
	}

	// Get resources from each context separately to track context origin
	var allResources []map[string]interface{}
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, contextName := range contexts {
		wg.Add(1)
		go func(ctx string) {
			defer wg.Done()

			// Get GVR from GVK
			gvr, err := kube.GetGVRForContext(ctx, schemaGVK)
			if err != nil {
				log.Printf("Warning: failed to get GVR for %s in context %s: %v", schemaGVK.Kind, ctx, err)
				return
			}

			// Create resource controller for this context
			controller := kube.NewResourceControllerForContext(ctx, gvr)

			// Start the informer
			_, err = controller.Inform()
			if err != nil {
				log.Printf("Warning: failed to start informer for %s in context %s: %v", schemaGVK.Kind, ctx, err)
				return
			}

			// Get objects from controller
			objs := controller.Objects()

			mu.Lock()
			for _, obj := range objs {
				resource := obj.Object
				// Add _context field to indicate which context this resource came from
				resource["_context"] = ctx
				allResources = append(allResources, resource)
			}
			mu.Unlock()
		}(contextName)
	}

	wg.Wait()

	return allResources, nil
}

// convertNodeTree converts kube.Node map to frontend TreeNode array
func convertNodeTree(nodes map[string]*kube.Node) []*TreeNode {
	result := make([]*TreeNode, 0, len(nodes))

	for name, node := range nodes {
		// Skip apiVersion and kind (TUI also skips these)
		if name == "apiVersion" || name == "kind" {
			continue
		}

		treeNode := &TreeNode{
			Name:     node.Name(),
			Type:     node.Type(),
			FullPath: node.NodeFullPath(), // Use NodeFullPath instead of FullPath to include array indices
			Level:    node.Level(),
			Children: convertNodeTree(node.Children()),
		}

		result = append(result, treeNode)
	}

	// Sort result: * always comes first, then numeric indices (sorted numerically), then alphabetically
	sort.Slice(result, func(i, j int) bool {
		// * always comes first
		if result[i].Name == "*" {
			return true
		}
		if result[j].Name == "*" {
			return false
		}

		// Try to parse as numbers
		numI, errI := strconv.Atoi(result[i].Name)
		numJ, errJ := strconv.Atoi(result[j].Name)

		// Both are numbers: sort numerically
		if errI == nil && errJ == nil {
			return numI < numJ
		}

		// One is a number, one is not: numbers come first (after *)
		if errI == nil {
			return true
		}
		if errJ == nil {
			return false
		}

		// Both are strings: sort alphabetically
		return result[i].Name < result[j].Name
	})

	return result
}

// SaveFile opens a save file dialog and saves the content to the selected file
// Returns the path where the file was saved, or empty string if cancelled
func (a *App) SaveFile(defaultFilename string, content string) (string, error) {
	// Get user's Downloads directory as default location
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	defaultDir := filepath.Join(homeDir, "Downloads")

	// Open save file dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultDirectory: defaultDir,
		DefaultFilename:  defaultFilename,
		Title:            "Save CSV File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "CSV Files (*.csv)",
				Pattern:     "*.csv",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}

	// User cancelled the dialog
	if filePath == "" {
		return "", nil
	}

	// Ensure .csv extension
	if !strings.HasSuffix(filePath, ".csv") {
		filePath += ".csv"
	}

	// Write content to file
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}


// FavoriteView types for frontend binding
type FavoriteViewGVK struct {
	Group   string `json:"group"`
	Version string `json:"version"`
	Kind    string `json:"kind"`
}

type FavoriteViewResponse struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	GVK       FavoriteViewGVK `json:"gvk"`
	Fields    [][]string      `json:"fields"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

func favoriteViewToResponse(v *store.FavoriteView) FavoriteViewResponse {
	return FavoriteViewResponse{
		ID:   v.ID,
		Name: v.Name,
		GVK: FavoriteViewGVK{
			Group:   v.GVK.Group,
			Version: v.GVK.Version,
			Kind:    v.GVK.Kind,
		},
		Fields:    v.Fields,
		CreatedAt: v.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: v.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListFavoriteViews returns all favorite views.
func (a *App) ListFavoriteViews() ([]FavoriteViewResponse, error) {
	if a.favoriteStore == nil {
		return nil, fmt.Errorf("favorite store not initialized")
	}

	views := a.favoriteStore.ListAll()
	result := make([]FavoriteViewResponse, len(views))
	for i, v := range views {
		result[i] = favoriteViewToResponse(&v)
	}
	return result, nil
}

// GetFavoriteViewsForGVK returns favorite views for a specific GVK.
func (a *App) GetFavoriteViewsForGVK(group, version, kind string) ([]FavoriteViewResponse, error) {
	if a.favoriteStore == nil {
		return nil, fmt.Errorf("favorite store not initialized")
	}

	gvk := store.GVKRef{Group: group, Version: version, Kind: kind}
	views := a.favoriteStore.ListByGVK(gvk)
	result := make([]FavoriteViewResponse, len(views))
	for i, v := range views {
		result[i] = favoriteViewToResponse(&v)
	}
	return result, nil
}

// SaveFavoriteView saves current selection as a favorite.
func (a *App) SaveFavoriteView(name, group, version, kind string, fields [][]string) (*FavoriteViewResponse, error) {
	if a.favoriteStore == nil {
		return nil, fmt.Errorf("favorite store not initialized")
	}

	gvk := store.GVKRef{Group: group, Version: version, Kind: kind}
	view, err := a.favoriteStore.Create(name, gvk, fields)
	if err != nil {
		return nil, err
	}

	if err := a.favoriteStore.Save(); err != nil {
		return nil, fmt.Errorf("failed to save: %w", err)
	}

	result := favoriteViewToResponse(view)
	return &result, nil
}

// DeleteFavoriteView removes a favorite view by ID.
func (a *App) DeleteFavoriteView(id string) error {
	if a.favoriteStore == nil {
		return fmt.Errorf("favorite store not initialized")
	}

	if err := a.favoriteStore.Delete(id); err != nil {
		return err
	}

	return a.favoriteStore.Save()
}

// RenameFavoriteView updates the name of a favorite view.
func (a *App) RenameFavoriteView(id, newName string) (*FavoriteViewResponse, error) {
	if a.favoriteStore == nil {
		return nil, fmt.Errorf("favorite store not initialized")
	}

	view, err := a.favoriteStore.Rename(id, newName)
	if err != nil {
		return nil, err
	}

	if err := a.favoriteStore.Save(); err != nil {
		return nil, fmt.Errorf("failed to save: %w", err)
	}

	result := favoriteViewToResponse(view)
	return &result, nil
}
