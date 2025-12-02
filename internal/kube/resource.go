package kube

import (
	"context"
	"fmt"
	"sort"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type emitMsg struct {
	Obj *unstructured.Unstructured
}

type ResourceController struct {
	contextName string // optional, for GUI multi-context support
	client      dynamic.Interface
	gvr         schema.GroupVersionResource
	store       cache.Store
	emitCh      chan emitMsg
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
		contextName: contextName,
		client:      client,
		gvr:         gvr,
		emitCh:      make(chan emitMsg, 1),
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
	sort.Slice(objs, func(i, j int) bool {
		// TODO: sort by namespace if gvr is namespaced
		return objs[i].GetName() < objs[j].GetName()
	})
	return objs
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
		Handler: cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				u := obj.(*unstructured.Unstructured)

				go func() { i.emitCh <- emitMsg{Obj: u} }()
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				n := newObj.(*unstructured.Unstructured)

				go func() { i.emitCh <- emitMsg{Obj: n} }()
			},
			DeleteFunc: func(obj interface{}) {
				d := obj.(*unstructured.Unstructured)

				go func() { i.emitCh <- emitMsg{Obj: d} }()
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

func (i *ResourceController) EventEmitted() <-chan emitMsg {
	return i.emitCh
}
