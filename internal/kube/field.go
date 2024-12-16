package kube

type Field struct {
	Name     string
	Prefix   []string
	Level    int
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

func (f *Field) FullPath() []string {
	fullPath := []string{}
	fullPath = append(fullPath, f.Prefix...)
	fullPath = append(fullPath, f.Name)
	return fullPath
}
