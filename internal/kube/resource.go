package kube

import (
	"context"
	"fmt"
	"log"
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
	client dynamic.Interface
	gvr    schema.GroupVersionResource
	store  cache.Store
	emitCh chan emitMsg
}

func NewResourceController(gvr schema.GroupVersionResource) *ResourceController {
	client, err := DynamicClient()
	if err != nil {
		panic(err)
	}

	return &ResourceController{
		client: client,
		gvr:    gvr,
		emitCh: make(chan emitMsg, 1),
	}
}

func (i *ResourceController) GetObjects() []*unstructured.Unstructured {
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
				log.Printf("add %s/%s [%s %s]", u.GetNamespace(), u.GetName(), u.GetAPIVersion(), u.GetKind())
				go func() { i.emitCh <- emitMsg{Obj: u} }()
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				n := newObj.(*unstructured.Unstructured)
				log.Printf("update %s/%s [%s %s]", n.GetNamespace(), n.GetName(), n.GetAPIVersion(), n.GetKind())
				go func() { i.emitCh <- emitMsg{Obj: n} }()
			},
			DeleteFunc: func(obj interface{}) {
				d := obj.(*unstructured.Unstructured)
				log.Printf("delete %s/%s [%s %s]", d.GetNamespace(), d.GetName(), d.GetAPIVersion(), d.GetKind())
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
