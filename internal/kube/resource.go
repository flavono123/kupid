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
	objs   []*unstructured.Unstructured
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

func (i *Informer) GetObjects() []*unstructured.Unstructured {
	return i.objs
}

func (i *Informer) Inform() (chan struct{}, error) {
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
				i.objs = append(i.objs, obj.(*unstructured.Unstructured))
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				o := oldObj.(*unstructured.Unstructured)
				n := newObj.(*unstructured.Unstructured)

				for idx, obj := range i.objs {
					if obj.GetName() == o.GetName() {
						i.objs[idx] = n
						break
					}
				}
			},
			DeleteFunc: func(obj interface{}) {
				u := obj.(*unstructured.Unstructured)
				for idx, obj := range i.objs {
					if obj.GetName() == u.GetName() {
						i.objs = append(i.objs[:idx], i.objs[idx+1:]...)
						break
					}
				}
			},
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
