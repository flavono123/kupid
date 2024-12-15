package kube

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Informer struct {
	client dynamic.Interface
	gvr    schema.GroupVersionResource
}

func NewInformer(gvr schema.GroupVersionResource) *Informer {
	client, err := DynamicClient()
	if err != nil {
		panic(err)
	}
	return &Informer{
		client: client,
		gvr:    gvr,
	}
}

type ResourceEventHandler interface {
	Add(obj interface{})
	Update(oldObj, newObj interface{})
	Delete(obj interface{})
}

func (i *Informer) Inform(handler ResourceEventHandler) (chan struct{}, error) {
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
			AddFunc:    func(obj interface{}) { handler.Add(obj) },
			UpdateFunc: func(oldObj, newObj interface{}) { handler.Update(oldObj, newObj) },
			DeleteFunc: func(obj interface{}) { handler.Delete(obj) },
		},
	}
	_, controller := cache.NewInformerWithOptions(
		options,
	)

	stop := make(chan struct{})
	go controller.Run(stop)

	if !cache.WaitForCacheSync(stop, controller.HasSynced) {
		close(stop)
		return nil, fmt.Errorf("failed to sync cache")
	}

	return stop, nil
}
