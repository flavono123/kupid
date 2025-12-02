package kube

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

var _ = Describe("Node", func() {
	Describe("Pickable", func() {
		It("should return false if node has children", func() {
			node := &Node{
				children: map[string]*Node{"child": {}},
			}
			Expect(node.Pickable(nil)).To(BeFalse())
		})

		It("should return true for primitive field with value", func() {
			node := &Node{
				name: "foo",
				field: &Field{
					Type: "string",
				},
			}
			objs := []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"foo": "bar",
					},
				},
			}
			Expect(node.Pickable(objs)).To(BeTrue())
		})

		It("should return false for primitive field without value", func() {
			node := &Node{
				name: "foo",
				field: &Field{
					Type: "string",
				},
			}
			objs := []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{},
				},
			}
			Expect(node.Pickable(objs)).To(BeFalse())
		})

		It("should return false for non-primitive field", func() {
			node := &Node{
				name: "foo",
				field: &Field{
					Type: "map[string]string",
				},
			}
			objs := []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"foo": map[string]interface{}{"a": "b"},
					},
				},
			}
			Expect(node.Pickable(objs)).To(BeFalse())
		})
	})
})
