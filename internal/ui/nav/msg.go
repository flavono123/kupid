package nav

import "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

type SetNavMsg struct {
	Objs []*unstructured.Unstructured
}
