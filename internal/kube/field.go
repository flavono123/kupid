package kube

type Field struct {
	Name     string
	Prefix   []string
	Level    int
	Type     string
	Required bool

	Enum     []string          // optional
	Children map[string]*Field // optional
}
