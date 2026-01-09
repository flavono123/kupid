package result

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/flavono123/kupid/internal/kube"
)

type SetResultMsg struct {
	Nodes      []*kube.Node
	Objs       []*unstructured.Unstructured
	Picked     bool
	PickedNode *kube.Node
}

type SetTableCandidateMsg struct {
	Candidate *kube.Node
}
