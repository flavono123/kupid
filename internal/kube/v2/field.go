package v2

type Field struct {
	Name     string
	Level    int // maybe not needed
	Type     string
	Required bool

	Enum     []string          // optional
	Children map[string]*Field // optional
}
