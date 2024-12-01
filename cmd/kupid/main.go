package main

import (
	"github.com/flavono123/kupid/internal/kube"
)

func main() {
	kube.GetSchema("io.k8s.api.core.v1.Pod")
}
