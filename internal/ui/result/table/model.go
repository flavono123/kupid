package table

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/event"
	"github.com/flavono123/kupid/internal/ui/theme"
	"github.com/sahilm/fuzzy"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	TABLE_WIDTH_RATIO = 0.7
	TABLE_SCROLL_STEP = 1
)

type fuzzyMatchedRow struct {
	cells    []string
	matches  map[int]fuzzy.Match
	scoreSum int
}

type tableStyles struct {
	selected  lipgloss.Style
	candidate lipgloss.Style
	debug     lipgloss.Style
}

type Model struct {
	focus         bool // same with result model, sync by msg
	keys          keyMap
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

func NewModel(nodes []*kube.Node, objs []*unstructured.Unstructured) *Model {
	// TODO: should 0 when no objs, impl with no resources view
	nameMaxWidth := 4 // Name
	for _, obj := range objs {
		if len(displayName(obj)) > nameMaxWidth {
			nameMaxWidth = len(displayName(obj))
		}
	}

	m := &Model{
		keys:          newKeyMap(),
		cursor:        0,
		nodes:         nodes,
		objs:          objs,
		rowsView:      viewport.New(0, 0),
		nameMaxWidth:  nameMaxWidth,
		nodeMaxWidths: []int{},
		styles: tableStyles{
			selected:  lipgloss.NewStyle().Background(theme.Surface0()),
			candidate: lipgloss.NewStyle().Margin(0, 0, 0, 1).Foreground(theme.Surface2()),
			debug:     lipgloss.NewStyle().Italic(true).Foreground(theme.Surface1()),
		},
		keyword: "",
	}
	return m
}

func (m *Model) Init() tea.Cmd {
	return nil
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case SetCandidateMsg:
		if m.WillOverWidth(msg.Candidate) {
			// do not render candidate
			m.setCandidate(nil)
			return m, m.warnOverwidth(msg.Candidate.NodeFullPath()...)
		}

		m.setCandidate(msg.Candidate)
	case SetKeywordMsg:
		m.setKeyword(msg.Keyword)
	case SetTableMsg:
		m.setNodes(msg.Nodes)
		m.setObjs(msg.Objs)
		cmd = m.tableUpdated()
	case tea.WindowSizeMsg:
		m.setViewSize(msg)
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.up):
			if m.isCursorTop() {
				m.cursor--
			} else {
				m.rowsView.LineUp(TABLE_SCROLL_STEP)
			}
		case key.Matches(msg, m.keys.down):
			if m.isCursorBottom() {
				m.cursor++
			} else {
				m.rowsView.LineDown(TABLE_SCROLL_STEP)
			}
		}
	}

	return m, cmd
}

func (m *Model) View() string {
	content := m.renderRow()
	m.rowsView.SetContent(content)
	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderHeader(),
		m.rowsView.View(),
	)
}

func (m *Model) Keyword() string {
	return m.keyword
}

func (m *Model) Focus() tea.Cmd {
	m.focus = true
	return nil
}

func (m *Model) Blur() {
	m.focus = false
}

func (m *Model) warnOverwidth(path ...string) tea.Cmd {
	return func() tea.Msg {
		return event.SetStatusMsg{
			Message: fmt.Sprintf("`%s' will over current window's width", strings.Join(path, ".")),
			Status:  event.Warn,
		}
	}
}

func (m *Model) headerStyle() lipgloss.Style {
	style := lipgloss.NewStyle().Foreground(theme.Surface2())
	if m.focus {
		style = style.Foreground(theme.Blue())
	}
	return style
}

func (m *Model) renderHeader() string {
	var render strings.Builder
	// headers
	if len(m.objs) > 0 {
		render.WriteString(m.cellStyle(0).Render("NAME"))
		for i, node := range m.nodes {
			render.WriteString(m.cellStyle(i + 1).Render(node.HeaderName()))
		}
	}

	if m.candidate != nil {
		return lipgloss.JoinHorizontal(
			lipgloss.Left,
			m.headerStyle().Render(render.String()),
			m.styles.candidate.Render(m.candidate.HeaderName()),
		)
	}

	return m.headerStyle().Render(render.String())
}

func (m *Model) renderRow() string {
	rows := []fuzzyMatchedRow{}
	// 모든 행에 대해 cells 준비
	for _, obj := range m.objs {
		cells := []string{}
		cells = append(cells, displayName(obj))
		for _, node := range m.nodes {
			cells = append(cells, kube.ValStr(node, obj))
		}
		// 후보 노드가 있으면 cells에 추가
		if m.candidate != nil {
			cells = append(cells, kube.ValStr(m.candidate, obj))
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

	lines := make([]string, 0, len(rows))
	var builder strings.Builder

	if m.keyword != "" {
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].scoreSum > rows[j].scoreSum
		})
	}

	for i, row := range rows {
		if m.keyword != "" && len(row.matches) == 0 {
			continue
		}

		builder.Reset()
		for j, cell := range row.cells {
			var renderedCell string
			if j == len(row.cells)-1 && m.candidate != nil {
				if match, ok := row.matches[j]; ok {
					renderedCell = m.styles.candidate.Render(highlight(cell, match, m.styles.candidate.Margin(0, 0, 0, 0)))
				} else {
					renderedCell = m.styles.candidate.Render(cell)
				}
			} else {
				if match, ok := row.matches[j]; ok {
					renderedCell = m.cellStyle(j).Render(highlight(cell, match, lipgloss.NewStyle().Foreground(theme.Text())))
				} else {
					renderedCell = m.cellStyle(j).Render(cell)
				}
			}
			builder.WriteString(renderedCell)
		}

		line := builder.String()
		if m.isCursor(i) {
			line = m.styles.selected.Render(line)
		}
		lines = append(lines, line)
	}

	return strings.Join(lines, "\n")
}

func (m *Model) isCursor(index int) bool {
	return index == m.cursor+m.rowsView.YOffset
}

func (m *Model) setNodeMaxWidths(nodes []*kube.Node) {
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
		max := len(node.HeaderName())
		for _, obj := range m.objs {
			if len(kube.ValStr(node, obj)) > max {
				max = len(kube.ValStr(node, obj))
			}
		}
		nodeMaxWidths = append(nodeMaxWidths, max)
	}

	m.nodeMaxWidths = nodeMaxWidths
}

func (m *Model) cellStyle(col int) lipgloss.Style {
	return lipgloss.NewStyle().Margin(0, 0, 0, 1).Width(m.colMaxWidth(col))
}

func (m *Model) setNodes(nodes []*kube.Node) {
	m.setNodeMaxWidths(nodes)
	m.nodes = nodes
}

func (m *Model) setObjs(objs []*unstructured.Unstructured) {
	m.objs = objs
}

func (m *Model) colMaxWidth(idxPlusOne int) int {
	// first col is always name
	if idxPlusOne < 1 {
		return m.nameMaxWidth
	}

	// shift left for nodes
	return m.nodeMaxWidths[idxPlusOne-1]
}

func (m *Model) setCandidate(candidate *kube.Node) {
	m.candidate = candidate
}

func (m *Model) isCursorTop() bool {
	return m.cursor > 0
}

func (m *Model) isCursorBottom() bool {
	// objs size as an index(-1) and the root status bar(-1)
	return m.cursor < min(len(m.objs)-1, m.rowsView.Height-2)
}

func (m *Model) setViewSize(msg tea.WindowSizeMsg) {
	m.rowsView.Width = int(float64(msg.Width) * TABLE_WIDTH_RATIO)
	m.rowsView.Height = msg.Height - 2 // HACK: (topbar 1 + header 1) + root status bar + 1
}

func (m *Model) WillOverWidth(node *kube.Node) bool {
	if node == nil {
		return false
	}

	return m.TableWidth()+m.maxWidth(node) > m.rowsView.Width-9 // magic num again, safty margin
}

func (m *Model) maxWidth(node *kube.Node) int {
	max := len(node.Name())
	for _, obj := range m.objs {
		if len(kube.ValStr(node, obj)) > max {
			max = len(kube.ValStr(node, obj))
		}
	}
	return max
}

func (m *Model) TableWidth() int {
	width := 0
	for col := 0; col < m.cols(); col++ {
		width += m.colMaxWidth(col) + 1 // margin?
	}
	return width
}

func (m *Model) cols() int {
	return len(m.nodes) + 1 // name + nodes
}

func (m *Model) setKeyword(keyword string) {
	m.keyword = keyword
}

// helpers
func highlight(s string, match fuzzy.Match, unmatchedStyle lipgloss.Style) string {
	highlightStyle := lipgloss.NewStyle().Foreground(theme.Blue())

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

func displayName(obj *unstructured.Unstructured) string {
	// TODO: gonna be namespace toggling feature
	// HACK: to reduce the width of table before viewport supporting horizontal scroll
	// if obj.GetNamespace() != "" {
	// 	return fmt.Sprintf("%s/%s", obj.GetNamespace(), obj.GetName())
	// }
	return obj.GetName()
}

func (m *Model) tableUpdated() tea.Cmd {
	return func() tea.Msg {
		return event.TableUpdatedMsg{Width: m.TableWidth()}
	}
}
