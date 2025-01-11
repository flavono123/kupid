package kube

import "strings"

// field is a struct parsed from schema doc
// array, object types are indented to have children with two levels difference
// this would be enriched as Node when create node tree from fields
type Field struct {
	Name     string
	Prefix   []string // TODO: rename to Ancestors?
	Level    int      // ? move to node?
	Type     string
	Required bool
	// optional
	Enum     []string
	Children map[string]*Field
}

func (f *Field) IsArray() bool {
	return strings.HasPrefix(f.Type, "[]")
}

func (f *Field) IsMap() bool {
	return strings.HasPrefix(f.Type, "map[string]")
}

func (f *Field) IsObject() bool {
	return f.Children != nil
}

func (f *Field) IsPrimitive() bool {
	return !f.IsArray() && !f.IsMap() && !f.IsObject()
}
