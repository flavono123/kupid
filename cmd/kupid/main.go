package main

import (
	"log"

	"github.com/flavono123/kupid/internal/kube"
)

func main() {
	// kube.GetSchema("io.k8s.api.core.v1.Pod")
	nodes, err := kube.GetNodes("io.k8s.api.core.v1.Node")
	if err != nil {
		log.Fatalf("failed to get nodes: %v", err)
	}
	kube.PrintNodes(nodes, 0)
}
