package kube

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	clientSetOnce      sync.Once
	clientSetSingleton *kubernetes.Clientset
	clientSetErr       error
)

func DiscoveryClient() (discovery.DiscoveryInterface, error) {
	clientSet, err := clientSet()
	if err != nil {
		return nil, err
	}
	return clientSet.Discovery(), nil
}

func clientSet() (*kubernetes.Clientset, error) {
	clientSetOnce.Do(func() {
		config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
		if err != nil {
			clientSetErr = fmt.Errorf("failed to get in-cluster config: %v", err)
		}
		clientSetSingleton, err = kubernetes.NewForConfig(config)
		if err != nil {
			clientSetErr = fmt.Errorf("failed to create client: %v", err)
			return
		}
	})
	return clientSetSingleton, clientSetErr
}
