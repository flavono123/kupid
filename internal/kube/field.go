package kube

type Field struct {
	Name     string
	Level    int // maybe not needed
	Type     string
	Required bool

	Enum     []string          // optional
	Children map[string]*Field // optional

	// render on ui
	// TODO: wrap renderableField struct in ui package
	Expanded bool
	Selected bool
}

func (f *Field) Foldable() bool {
	return f.Children != nil
}
