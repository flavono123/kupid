package kube

type Field struct {
	Name     string
	Prefix   []string // TODO: move to node
	Level    int      // ? move to node?
	Type     string
	Required bool
	// optional
	Enum     []string
	Children map[string]*Field
}
