package kube

type Property struct {
	Name string
	Path string
	// Default  string
	Types    []string
	Children map[string]*Property
}
