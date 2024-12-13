package v2

import "fmt"

type Field struct {
	Name     string
	Level    int // maybe not needed
	Type     string
	Required bool

	Enum     []string          // optional
	Children map[string]*Field // optional

	// render on ui
	Expanded bool
}

func (f *Field) String() string {
	return fmt.Sprintf("%s<%s>", f.Name, f.Type)
}

func (f *Field) Foldable() bool {
	return f.Children != nil
}
