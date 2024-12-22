package ui

const (
	// TODO: support dynamic windows size
	// mabye static const would be replaced min, max values
	UPPER_20 = 0.8

	WIDTH  = 180 // HACK: longing for https://github.com/charmbracelet/bubbles/pull/240
	HEIGHT = 45

	SCHEMA_WIDTH               = WIDTH
	SCHEMA_HEIGHT              = 20
	SCHEMA_CURSOR_TOP          = 0
	SCHEMA_CURSOR_BOTTOM       = SCHEMA_HEIGHT - 1 - 2 // HACK: border margin 2
	SCHEMA_SCROLL_STEP         = 1
	SCHEMA_EXPAND_MULTI_MARGIN = 3

	KBAR_WIDTH                     = 50
	KBAR_SEARCH_RESULTS_MAX_HEIGHT = 10

	KBAR_SCROLL_STEP = 1
)
