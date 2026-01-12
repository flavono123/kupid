package kube

import (
	"context"
	"fmt"
	"log"
	"sort"
	"sync"
	"sync/atomic"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// MetaNamespaceKeyFunc is a wrapper for cache.MetaNamespaceKeyFunc
// Returns "namespace/name" for namespaced objects, "name" for cluster-scoped
func MetaNamespaceKeyFunc(obj interface{}) (string, error) {
	return cache.MetaNamespaceKeyFunc(obj)
}

// Event metrics for debugging memory leaks
var (
	eventsEmitted atomic.Int64
	eventsDropped atomic.Int64
)

// GetEventMetrics returns the current event metrics (emitted, dropped)
func GetEventMetrics() (emitted, dropped int64) {
	return eventsEmitted.Load(), eventsDropped.Load()
}

// ResetEventMetrics resets the event counters to zero
func ResetEventMetrics() {
	eventsEmitted.Store(0)
	eventsDropped.Store(0)
}

// EventType represents the type of watch event
type EventType string

const (
	EventAdded    EventType = "ADDED"
	EventModified EventType = "MODIFIED"
	EventDeleted  EventType = "DELETED"
)

// WatchEvent represents a watch event with type and object
type WatchEvent struct {
	Type   EventType
	Obj    *unstructured.Unstructured
	OldObj *unstructured.Unstructured // Only set for MODIFIED events
}

// Deprecated: use WatchEvent instead
type emitMsg = WatchEvent

type ResourceController struct {
	contextName string // optional, for GUI multi-context support
	client      dynamic.Interface
	gvr         schema.GroupVersionResource
	store       cache.Store
	emitCh      chan emitMsg
	doneCh      chan struct{} // signals that controller is closed (for event consumers)
	closed      atomic.Bool   // guards trySend to prevent sends after close

	// sortKeyCache stores sort keys (namespace/name) by object UID for race-free sorting.
	// Using UID as map key because object pointers may change on updates.
	// Updated synchronously by informer handlers, read by Objects().
	sortKeyCache   map[string]string // UID -> "namespace/name" or just "name"
	sortKeyCacheMu sync.RWMutex
}

// NewResourceController creates a controller for the current context (legacy, kept for TUI compatibility)
func NewResourceController(gvr schema.GroupVersionResource) *ResourceController {
	return NewResourceControllerForContext("", gvr)
}

// NewResourceControllerForContext creates a controller for the specified context
// If contextName is empty, uses the current context
func NewResourceControllerForContext(contextName string, gvr schema.GroupVersionResource) *ResourceController {
	client, err := DynamicClientForContext(contextName)
	if err != nil {
		panic(err)
	}

	if contextName == "" {
		contextName, _ = GetCurrentContext()
	}

	return &ResourceController{
		contextName:  contextName,
		client:       client,
		gvr:          gvr,
		emitCh:       make(chan emitMsg, 256),
		doneCh:       make(chan struct{}),
		sortKeyCache: make(map[string]string),
	}
}

// Context returns the context name this controller is connected to
func (i *ResourceController) Context() string {
	return i.contextName
}

func (i *ResourceController) Objects() []*unstructured.Unstructured {
	objs := make([]*unstructured.Unstructured, 0)
	for _, obj := range i.store.List() {
		objs = append(objs, obj.(*unstructured.Unstructured))
	}

	// Use cached sort keys to avoid race conditions.
	// Sort keys are cached by UID in handlers - no object reads needed during sort.
	i.sortKeyCacheMu.RLock()
	sort.Slice(objs, func(a, b int) bool {
		uidA := string(objs[a].GetUID())
		uidB := string(objs[b].GetUID())
		return i.sortKeyCache[uidA] < i.sortKeyCache[uidB]
	})
	i.sortKeyCacheMu.RUnlock()

	return objs
}

// GetByKey returns a resource by its key (namespace/name or just name for cluster-scoped)
// Returns nil if not found or store is not initialized
func (i *ResourceController) GetByKey(key string) *unstructured.Unstructured {
	if i.store == nil {
		return nil
	}
	obj, exists, err := i.store.GetByKey(key)
	if err != nil || !exists {
		return nil
	}
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil
	}
	return u
}

func (i *ResourceController) Inform() (chan struct{}, error) {
	lw := &cache.ListWatch{
		ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
			return i.client.Resource(i.gvr).Namespace("").List(context.Background(), options)
		},
		WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
			return i.client.Resource(i.gvr).Namespace("").Watch(context.Background(), options)
		},
	}

	options := cache.InformerOptions{
		ListerWatcher: lw,
		ObjectType:    &unstructured.Unstructured{},
		// Transform removes unused fields before storing in cache to reduce memory
		Transform: func(obj interface{}) (interface{}, error) {
			u, ok := obj.(*unstructured.Unstructured)
			if !ok {
				return obj, nil
			}
			// Deep copy to avoid race conditions - the original object may be read concurrently
			u = u.DeepCopy()

			// Remove managedFields to reduce memory usage
			unstructured.RemoveNestedField(u.Object, "metadata", "managedFields")

			return u, nil
		},
		Handler: cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				u, ok := obj.(*unstructured.Unstructured)
				if !ok {
					return
				}
				// Cache sort key by UID for race-free sorting in Objects()
				uid := string(u.GetUID())
				sortKey, _ := cache.MetaNamespaceKeyFunc(u)
				i.sortKeyCacheMu.Lock()
				i.sortKeyCache[uid] = sortKey
				i.sortKeyCacheMu.Unlock()

				i.trySend(emitMsg{Type: EventAdded, Obj: u})
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				n, ok := newObj.(*unstructured.Unstructured)
				if !ok {
					return
				}
				o, _ := oldObj.(*unstructured.Unstructured) // may be nil if not castable

				// Update cached sort key (UID stays same, but cache it anyway for consistency)
				uid := string(n.GetUID())
				sortKey, _ := cache.MetaNamespaceKeyFunc(n)
				i.sortKeyCacheMu.Lock()
				i.sortKeyCache[uid] = sortKey
				i.sortKeyCacheMu.Unlock()

				i.trySend(emitMsg{Type: EventModified, Obj: n, OldObj: o})
			},
			DeleteFunc: func(obj interface{}) {
				var d *unstructured.Unstructured

				// Handle DeletedFinalStateUnknown wrapper
				if deleted, ok := obj.(cache.DeletedFinalStateUnknown); ok {
					d, ok = deleted.Obj.(*unstructured.Unstructured)
					if !ok {
						return
					}
				} else {
					var ok bool
					d, ok = obj.(*unstructured.Unstructured)
					if !ok {
						return
					}
				}

				// Remove from sort key cache
				uid := string(d.GetUID())
				i.sortKeyCacheMu.Lock()
				delete(i.sortKeyCache, uid)
				i.sortKeyCacheMu.Unlock()

				i.trySend(emitMsg{Type: EventDeleted, Obj: d})
			},
		},
	}
	store, controller := cache.NewInformerWithOptions(
		options,
	)
	i.store = store

	stop := make(chan struct{})
	go controller.Run(stop)

	if !cache.WaitForCacheSync(stop, controller.HasSynced) {
		close(stop)
		return nil, fmt.Errorf("failed to sync cache")
	}

	return stop, nil
}

// WatchEvents returns a read-only channel of watch events
func (i *ResourceController) WatchEvents() <-chan WatchEvent {
	return i.emitCh
}

// Deprecated: use WatchEvents instead
func (i *ResourceController) EventEmitted() <-chan emitMsg {
	return i.emitCh
}

// trySend attempts to send an event to the channel without blocking.
// If the channel buffer is full or controller is closed, the event is dropped.
// This is safe for Kubernetes watch events since they send full object state.
func (i *ResourceController) trySend(msg emitMsg) {
	if i.closed.Load() {
		return
	}
	select {
	case i.emitCh <- msg:
		eventsEmitted.Add(1)
	default:
		// buffer full, drop event (next event will have latest state)
		dropped := eventsDropped.Add(1)
		if dropped%100 == 1 { // Log every 100 drops to avoid spam
			log.Printf("[WARN] Event dropped (total: %d, buffer full for %s/%s)",
				dropped, i.contextName, i.gvr.Resource)
		}
	}
}

// Done returns a channel that is closed when the controller is closed.
// Use this to detect when to stop consuming events from WatchEvents().
func (i *ResourceController) Done() <-chan struct{} {
	return i.doneCh
}

// Close marks the controller as closed and signals consumers to stop.
// After Close is called, new events will be dropped.
// It is safe to call Close multiple times (subsequent calls are no-ops).
func (i *ResourceController) Close() {
	// Use atomic.Bool to ensure we only close doneCh once
	if i.closed.CompareAndSwap(false, true) {
		close(i.doneCh)
	}
}
