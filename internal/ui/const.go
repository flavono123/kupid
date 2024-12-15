package ui

const (
	// TODO: support dynamic windows size
	// mabye static const would be replaced min, max values
	UPPER_20 = 0.8

	WIDTH  = 80
	HEIGHT = 45

	SCHEMA_WIDTH         = WIDTH
	SCHEMA_HEIGHT        = 20
	SCHEMA_CURSOR_TOP    = 0
	SCHEMA_CURSOR_BOTTOM = SCHEMA_HEIGHT - 1 - 2 // HACK: border margin 2
	SCHEMA_SCROLL_STEP   = 1
)
