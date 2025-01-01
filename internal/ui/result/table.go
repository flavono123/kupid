package result

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/keymap"
	"github.com/flavono123/kupid/internal/ui/theme"
	"github.com/sahilm/fuzzy"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type fuzzyMatchedRow struct {
	cells    []string
	matches  map[int]fuzzy.Match
	scoreSum int
}

type tableStyles struct {
	header    lipgloss.Style
	selected  lipgloss.Style
	candidate lipgloss.Style
	debug     lipgloss.Style
}

type tableModel struct {
	keys          keymap.TableKeyMap
	cursor        int
	nodes         []*kube.Node
	objs          []*unstructured.Unstructured
	rowsView      viewport.Model
	nameMaxWidth  int
	nodeMaxWidths []int
	candidate     *kube.Node
	styles        tableStyles
	keyword       string
}

func newTableModel(nodes []*kube.Node, objs []*unstructured.Unstructured) *tableModel {
	// TODO: should 0 when no objs, impl with no resources view
	nameMaxWidth := 4 // Name
	for _, obj := range objs {
		if len(displayName(obj)) > nameMaxWidth {
			nameMaxWidth = len(displayName(obj))
		}
	}

	m := &tableModel{
		keys:          keymap.NewTableKeyMap(),
		cursor:        0,
		nodes:         nodes,
		objs:          objs,
		rowsView:      viewport.New(0, 0),
		nameMaxWidth:  nameMaxWidth,
		nodeMaxWidths: []int{},
		styles: tableStyles{
			header:    lipgloss.NewStyle().Bold(true),
			selected:  lipgloss.NewStyle().Background(theme.Surface0),
			candidate: lipgloss.NewStyle().Margin(0, 0, 0, 1).Foreground(theme.Surface2),
			debug:     lipgloss.NewStyle().Italic(true).Foreground(theme.Surface1),
		},
		keyword: "",
	}
	return m
}

func (m *tableModel) Init() tea.Cmd {
	return nil
}

func (m *tableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.setRowsViewSize(msg)
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.Up):
			if m.isCursorTop() {
				m.cursor--
			} else {
				m.rowsView.LineUp(TABLE_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.Down):
			if m.isCursorBottom() {
				m.cursor++
			} else {
				m.rowsView.LineDown(TABLE_SCROLL_STEP)
			}
		}
	}
	return m, cmd
}

func (m *tableModel) View() string {
	content := m.renderRow()
	m.rowsView.SetContent(content)
	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderHeader(),
		m.rowsView.View(),
		m.renderDebugBar(),
	)
}

func (m *tableModel) renderHeader() string {
	var render strings.Builder
	// headers
	if len(m.objs) > 0 {
		render.WriteString(m.cellStyle(0).Render("Name"))
		for i, node := range m.nodes {
			render.WriteString(m.cellStyle(i + 1).Render(node.Name()))
		}
	}

	if m.candidate != nil {
		return lipgloss.JoinHorizontal(
			lipgloss.Left,
			m.styles.header.Render(render.String()),
			m.styles.candidate.Render(m.candidate.Name()),
		)
	}

	return m.styles.header.Render(render.String())
}

func (m *tableModel) renderRow() string {
	rows := []fuzzyMatchedRow{}
	// 모든 행에 대해 cells 준비
	for _, obj := range m.objs {
		cells := []string{}
		cells = append(cells, displayName(obj))
		for _, node := range m.nodes {
			cells = append(cells, m.val(node, obj))
		}
		// 후보 노드가 있으면 cells에 추가
		if m.candidate != nil {
			cells = append(cells, m.val(m.candidate, obj))
		}

		matches := map[int]fuzzy.Match{}
		scoreSum := 0
		if m.keyword != "" {
			// 키워드가 있을 때만 퍼지 매치 수행
			for _, match := range fuzzy.Find(m.keyword, cells) {
				matches[match.Index] = match
				scoreSum += match.Score
			}
		}
		rows = append(rows, fuzzyMatchedRow{cells: cells, matches: matches, scoreSum: scoreSum})
	}

	lines := []string{}
	for i, row := range rows {
		if m.keyword != "" && len(row.matches) == 0 {
			continue // 키워드가 있고 매치가 없으면 건너뛰기
		}

		line := ""
		for j, cell := range row.cells {
			var renderedCell string
			if j == len(row.cells)-1 && m.candidate != nil {
				// candidate 열은 특별한 스타일 적용
				if match, ok := row.matches[j]; ok {
					renderedCell = m.styles.candidate.Render(highlight(cell, match, m.styles.candidate.Margin(0, 0, 0, 0))) // TODO: define candidate cell and text style for each
				} else {
					renderedCell = m.styles.candidate.Render(cell)
				}
			} else {
				// 일반 데이터 열
				if match, ok := row.matches[j]; ok {
					renderedCell = m.cellStyle(j).Render(highlight(cell, match, lipgloss.NewStyle().Foreground(theme.Text))) // TODO: define text style as a field
				} else {
					renderedCell = m.cellStyle(j).Render(cell)
				}
			}
			line += renderedCell
		}

		if m.isCursor(i) {
			line = m.styles.selected.Render(line)
		}
		lines = append(lines, line)
		sort.Slice(lines, func(i, j int) bool {
			return rows[i].scoreSum > rows[j].scoreSum
		})
	}

	return strings.Join(lines, "\n")
}

func (m *tableModel) isCursor(index int) bool {
	return index == m.cursor+m.rowsView.YOffset
}

func (m *tableModel) setNodeMaxWidths(nodes []*kube.Node) {
	// name
	nameMaxWidth := 4
	for _, obj := range m.objs {
		if len(displayName(obj)) > nameMaxWidth {
			nameMaxWidth = len(displayName(obj))
		}
	}
	m.nameMaxWidth = nameMaxWidth

	var nodeMaxWidths []int

	for _, node := range nodes {
		max := len(node.Name())
		for _, obj := range m.objs {
			if len(m.val(node, obj)) > max {
				max = len(m.val(node, obj))
			}
		}
		nodeMaxWidths = append(nodeMaxWidths, max)
	}

	m.nodeMaxWidths = nodeMaxWidths
}

func (m *tableModel) val(node *kube.Node, obj *unstructured.Unstructured) string {
	val, found, err := GetNestedValueWithIndex(obj.Object, node.NodeFullPath()...)
	if err != nil || !found {
		return "-"
	}

	if str, ok := val.(string); ok && len(str) == 0 { // edge case `""`
		return "\"\""
	}

	return fmt.Sprintf("%v", val)
}

func (m *tableModel) cellStyle(col int) lipgloss.Style {
	return lipgloss.NewStyle().Margin(0, 0, 0, 1).Width(m.colMaxWidth(col))
}

func (m *tableModel) setNodes(nodes []*kube.Node) {
	m.setNodeMaxWidths(nodes)
	m.nodes = nodes
}

func (m *tableModel) setObjs(objs []*unstructured.Unstructured) {
	m.objs = objs
}

func (m *tableModel) colMaxWidth(idxPlusOne int) int {
	// first col is always name
	if idxPlusOne < 1 {
		return m.nameMaxWidth
	}

	// shift left for nodes
	return m.nodeMaxWidths[idxPlusOne-1]
}

func (m *tableModel) setCandidate(candidate *kube.Node) {
	m.candidate = candidate
}

func (m *tableModel) isCursorTop() bool {
	return m.cursor > 0
}

func (m *tableModel) isCursorBottom() bool {
	// objs size as an index(-1) and the debug/help bar(-1)
	// rowsview height as an index(-1); already adjusted for the debug/help bar
	return m.cursor < min(len(m.objs)-1, m.rowsView.Height-1)
}

func (m *tableModel) setRowsViewSize(msg tea.WindowSizeMsg) {
	m.rowsView.Width = int(float64(msg.Width) * TABLE_WIDTH_RATIO)
	m.rowsView.Height = msg.Height - 3 // HACK: topbar 1 + debug line 1 + header 1
}

func (m *tableModel) renderDebugBar() string {
	return m.styles.debug.Render(
		fmt.Sprintf("vpwidth: %d, tablewidth: %d, cols: %d",
			m.rowsView.Width, m.tableWidth(), m.cols()),
	)
}

func (m *tableModel) willOverWidth(node *kube.Node) bool {
	if node == nil {
		return false
	}

	return m.tableWidth()+m.maxWidth(node) > m.rowsView.Width-9 // magic num again, safty margin
}

func (m *tableModel) maxWidth(node *kube.Node) int {
	max := len(node.Name())
	for _, obj := range m.objs {
		if len(m.val(node, obj)) > max {
			max = len(m.val(node, obj))
		}
	}
	return max
}

func (m *tableModel) tableWidth() int {
	width := 0
	for col := 0; col < m.cols(); col++ {
		width += m.colMaxWidth(col) + 1 // margin?
	}
	return width
}

func (m *tableModel) cols() int {
	return len(m.nodes) + 1 // name + nodes
}

func (m *tableModel) setKeyword(keyword string) {
	m.keyword = keyword
}

// helpers
func highlight(s string, match fuzzy.Match, unmatchedStyle lipgloss.Style) string {
	highlightStyle := lipgloss.NewStyle().Foreground(theme.Blue)

	runes := []rune(s)
	result := make([]rune, 0, len(runes))

	for i, r := range runes {
		if contains(match.MatchedIndexes, i) {
			result = append(result, []rune(highlightStyle.Render(string(r)))...)
		} else {
			result = append(result, []rune(unmatchedStyle.Render(string(r)))...)
		}
	}

	return string(result)
}

func contains(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}
