package kube

type PropertyBuilder struct {
	property *Property
}

func CreateProperty(name string) *PropertyBuilder {
	return &PropertyBuilder{
		property: &Property{
			Name:     name,
			Children: make(map[string]*Property),
		},
	}
}

func (b *PropertyBuilder) WithPath(path string) *PropertyBuilder {
	b.property.Path = path
	return b
}

func (b *PropertyBuilder) WithTypes(types []string) *PropertyBuilder {
	b.property.Types = types
	return b
}

func (b *PropertyBuilder) WithChildren(children map[string]*Property) *PropertyBuilder {
	b.property.Children = children
	return b
}

func (b *PropertyBuilder) WithNestedTypeChildren(nestedType string) *PropertyBuilder {
	b.property.Children = map[string]*Property{
		"*": CreateProperty("*").WithTypes([]string{nestedType}).Build(),
	}
	return b
}

func (b *PropertyBuilder) Build() *Property {
	return b.property
}
