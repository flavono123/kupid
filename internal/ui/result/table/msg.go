package table

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/flavono123/kupid/internal/kube"
)

type SetCandidateMsg struct {
	Candidate *kube.Node
}

type SetKeywordMsg struct {
	Keyword string
}

type SetTableMsg struct {
	Nodes []*kube.Node
	Objs  []*unstructured.Unstructured
}
