package kube

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
