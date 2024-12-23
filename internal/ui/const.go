package ui

const (
	// TODO: support dynamic windows size
	//longing for https://github.com/charmbracelet/bubbles/pull/240
	UPPER_20 = 0.8

	SCHEMA_CURSOR_TOP  = 0
	SCHEMA_SCROLL_STEP = 1

	SCHEMA_WIDTH_DIV            = 3
	SCHEMA_HEIGHT_BOTTOM_MARGIN = 4 // topbar 1 + border top, down 2 + help, status 1
	SCHEMA_EXPAND_MULTI_MARGIN  = 3 // render above 3 lines when cursor moved by fold/expand a lot

	KBAR_WIDTH_DIV                 = 3
	KBAR_SEARCH_RESULTS_MAX_HEIGHT = 10

	KBAR_SCROLL_STEP = 1
)
