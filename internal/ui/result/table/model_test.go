package table

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/flavono123/kattle/internal/kube"
)

var _ = Describe("Table", func() {
	Describe("Truncate", func() {
		It("should return original string if shorter than width", func() {
			Expect(truncate("hello", 10)).To(Equal("hello"))
		})

		It("should return original string if equal to width", func() {
			Expect(truncate("hello", 5)).To(Equal("hello"))
		})

		It("should truncate string if longer than width", func() {
			Expect(truncate("hello world", 5)).To(Equal("he..."))
		})

		It("should truncate very long string", func() {
			Expect(truncate("this is a very long string", 10)).To(Equal("this is..."))
		})
	})

	Describe("WillOverWidth", func() {
		It("should cap max width and return false if within limit", func() {
			longStr := ""
			for i := 0; i < 100; i++ {
				longStr += "a"
			}

			objs := []*unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"long": longStr,
					},
				},
			}

			m := NewModel(nil, objs)
			m.rowsView.Width = 100

			fieldTree := map[string]*kube.Field{
				"long": {
					Name: "long",
					Type: "string",
				},
			}
			nodes := kube.CreateNodeTree(fieldTree, objs, nil)
			longNode := nodes["long"]

			Expect(m.WillOverWidth(longNode)).To(BeFalse())
			Expect(m.maxWidth(longNode)).To(Equal(MAX_COLUMN_WIDTH))
		})
	})
})
