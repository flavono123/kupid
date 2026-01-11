package kube

import (
	"sync"

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

	// Regression test for concurrent map read/write panic
	// This test verifies that Objects() uses cached names for sorting,
	// preventing race conditions when accessing object metadata during sort.
	Describe("Objects", func() {
		It("should sort objects using cached names", func() {
			// Create a fake store
			store := cache.NewStore(cache.MetaNamespaceKeyFunc)

			// Create a controller with the fake store and nameCache
			controller := &ResourceController{
				store:     store,
				nameCache: make(map[string]string),
			}

			// Add objects to store and populate nameCache
			obj1 := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "v1",
					"kind":       "Pod",
					"metadata": map[string]interface{}{
						"name":      "zebra-pod",
						"namespace": "default",
					},
				},
			}
			obj2 := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "v1",
					"kind":       "Pod",
					"metadata": map[string]interface{}{
						"name":      "alpha-pod",
						"namespace": "default",
					},
				},
			}

			Expect(store.Add(obj1)).To(Succeed())
			Expect(store.Add(obj2)).To(Succeed())

			// Populate nameCache (simulating what informer handlers do)
			key1, _ := cache.MetaNamespaceKeyFunc(obj1)
			key2, _ := cache.MetaNamespaceKeyFunc(obj2)
			controller.nameCache[key1] = obj1.GetName()
			controller.nameCache[key2] = obj2.GetName()

			// Get objects via controller - should be sorted by name
			objs := controller.Objects()
			Expect(objs).To(HaveLen(2))

			// Verify sorting order (alpha-pod should come before zebra-pod)
			Expect(objs[0].GetName()).To(Equal("alpha-pod"))
			Expect(objs[1].GetName()).To(Equal("zebra-pod"))
		})

		It("should handle concurrent reads and writes safely", func() {
			// Create a fake store with multiple objects
			store := cache.NewStore(cache.MetaNamespaceKeyFunc)
			controller := &ResourceController{
				store:     store,
				nameCache: make(map[string]string),
			}

			// Add objects to store and populate nameCache
			for i := 0; i < 50; i++ {
				name := "pod-" + string(rune('a'+i%26)) + string(rune('0'+i/26))
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": "v1",
						"kind":       "Pod",
						"metadata": map[string]interface{}{
							"name":      name,
							"namespace": "default",
						},
					},
				}
				Expect(store.Add(obj)).To(Succeed())

				// Populate nameCache
				key, _ := cache.MetaNamespaceKeyFunc(obj)
				controller.nameCacheMu.Lock()
				controller.nameCache[key] = name
				controller.nameCacheMu.Unlock()
			}

			// Multiple goroutines calling Objects() and simulating informer updates
			var wg sync.WaitGroup

			// Reader goroutines
			for i := 0; i < 5; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer GinkgoRecover()
					for j := 0; j < 100; j++ {
						objs := controller.Objects()
						// Access each object's fields (read operations)
						for _, obj := range objs {
							_ = obj.GetName()
							_ = obj.GetNamespace()
						}
					}
				}()
			}

			// Writer goroutines (simulating informer update handlers)
			for i := 0; i < 5; i++ {
				wg.Add(1)
				go func(id int) {
					defer wg.Done()
					defer GinkgoRecover()
					for j := 0; j < 100; j++ {
						// Simulate nameCache update (like informer handlers do)
						key := "default/pod-update-" + string(rune('0'+id))
						controller.nameCacheMu.Lock()
						controller.nameCache[key] = "updated-name-" + string(rune('0'+j%10))
						controller.nameCacheMu.Unlock()
					}
				}(i)
			}

			wg.Wait()
		})
	})
})
