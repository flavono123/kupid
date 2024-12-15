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
)

var (
	clientSetOnce      sync.Once
	clientSetSingleton *kubernetes.Clientset
	clientSetErr       error

	dcOnce      sync.Once
	dcSingleton dynamic.Interface
	dcErr       error
)

func CurrentContext() (string, error) {

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	configOverrides := &clientcmd.ConfigOverrides{}
	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

	rawConfig, err := kubeConfig.RawConfig()
	if err != nil {
		return "", err
	}

	return rawConfig.CurrentContext, nil
}

func DiscoveryClient() (discovery.DiscoveryInterface, error) {
	clientSet, err := clientSet()
	if err != nil {
		return nil, err
	}
	return clientSet.Discovery(), nil
}

func DynamicClient() (dynamic.Interface, error) {
	dcOnce.Do(func() {
		config, err := kubeConfig()
		if err != nil {
			dcErr = fmt.Errorf("failed to get in-cluster config: %v", err)
			return
		}
		client, err := dynamic.NewForConfig(config)
		if err != nil {
			dcErr = fmt.Errorf("failed to create dynamic client: %v", err)
			return
		}
		dcSingleton = client
	})
	return dcSingleton, dcErr
}

func clientSet() (*kubernetes.Clientset, error) {
	clientSetOnce.Do(func() {
		var err error
		config, err := kubeConfig()
		if err != nil {
			clientSetErr = fmt.Errorf("failed to get in-cluster config: %v", err)
			return
		}
		clientSetSingleton, err = kubernetes.NewForConfig(config)
		if err != nil {
			clientSetErr = fmt.Errorf("failed to create client: %v", err)
			return
		}
	})
	return clientSetSingleton, clientSetErr
}

func kubeConfig() (*rest.Config, error) {
	config, err := clientcmd.BuildConfigFromFlags("", filepath.Join(os.Getenv("HOME"), ".kube", "config"))
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %v", err)
	}
	return config, nil
}
