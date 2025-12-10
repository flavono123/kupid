package kube

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/tools/cache"
)

var _ = Describe("ResourceController", func() {
	Describe("DeleteFunc handler", func() {
		var (
			emitCh  chan emitMsg
			testObj *unstructured.Unstructured
		)

		BeforeEach(func() {
			emitCh = make(chan emitMsg, 10)

			testObj = &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "v1",
					"kind":       "Pod",
					"metadata": map[string]interface{}{
						"name":      "test-pod",
						"namespace": "default",
					},
				},
			}
		})

		Context("when receiving direct Unstructured object", func() {
			It("should handle the deletion successfully", func() {
				// Simulate DeleteFunc receiving direct object
				handler := func(obj interface{}) {
					var d *unstructured.Unstructured

					// Handle DeletedFinalStateUnknown wrapper
					if deleted, ok := obj.(cache.DeletedFinalStateUnknown); ok {
						d, ok = deleted.Obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					} else {
						var ok bool
						d, ok = obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					}

					go func() { emitCh <- emitMsg{Obj: d} }()
				}

				handler(testObj)

				// Verify emission
				Eventually(emitCh).Should(Receive(Equal(emitMsg{Obj: testObj})))
			})
		})

		Context("when receiving DeletedFinalStateUnknown wrapper", func() {
			It("should unwrap and handle the deletion successfully", func() {
				// Wrap object in DeletedFinalStateUnknown
				wrappedObj := cache.DeletedFinalStateUnknown{
					Key: "default/test-pod",
					Obj: testObj,
				}

				// Simulate DeleteFunc receiving wrapped object
				handler := func(obj interface{}) {
					var d *unstructured.Unstructured

					// Handle DeletedFinalStateUnknown wrapper
					if deleted, ok := obj.(cache.DeletedFinalStateUnknown); ok {
						d, ok = deleted.Obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					} else {
						var ok bool
						d, ok = obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					}

					go func() { emitCh <- emitMsg{Obj: d} }()
				}

				handler(wrappedObj)

				// Verify emission
				Eventually(emitCh).Should(Receive(Equal(emitMsg{Obj: testObj})))
			})
		})

		Context("when receiving invalid type", func() {
			It("should not panic and should not emit", func() {
				// Simulate DeleteFunc receiving invalid type
				handler := func(obj interface{}) {
					var d *unstructured.Unstructured

					// Handle DeletedFinalStateUnknown wrapper
					if deleted, ok := obj.(cache.DeletedFinalStateUnknown); ok {
						d, ok = deleted.Obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					} else {
						var ok bool
						d, ok = obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					}

					go func() { emitCh <- emitMsg{Obj: d} }()
				}

				// Should not panic
				Expect(func() {
					handler("invalid-string-object")
				}).NotTo(Panic())

				// Should not emit anything
				Consistently(emitCh).ShouldNot(Receive())
			})
		})

		Context("when receiving DeletedFinalStateUnknown with invalid inner object", func() {
			It("should not panic and should not emit", func() {
				// Wrap invalid object in DeletedFinalStateUnknown
				wrappedObj := cache.DeletedFinalStateUnknown{
					Key: "default/test-pod",
					Obj: "invalid-inner-object",
				}

				// Simulate DeleteFunc receiving wrapped object with invalid inner type
				handler := func(obj interface{}) {
					var d *unstructured.Unstructured

					// Handle DeletedFinalStateUnknown wrapper
					if deleted, ok := obj.(cache.DeletedFinalStateUnknown); ok {
						d, ok = deleted.Obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					} else {
						var ok bool
						d, ok = obj.(*unstructured.Unstructured)
						if !ok {
							return
						}
					}

					go func() { emitCh <- emitMsg{Obj: d} }()
				}

				// Should not panic
				Expect(func() {
					handler(wrappedObj)
				}).NotTo(Panic())

				// Should not emit anything
				Consistently(emitCh).ShouldNot(Receive())
			})
		})
	})
})
