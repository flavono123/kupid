package result

import (
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type SetTableMsg struct {
	Nodes      []*kube.Node
	Objs       []*unstructured.Unstructured
	Picked     bool
	PickedNode *kube.Node
}

type SetCandidateMsg struct {
	Candidate *kube.Node
}
