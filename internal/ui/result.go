package ui

import (
	"fmt"
	"log"
	"math"
	"strconv"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type resultModel struct {
	focused bool
	table   *tableModel
	filter  textinput.Model

	width      int
	widthLimPB progress.Model
}

func newResultModel(objs []*unstructured.Unstructured) *resultModel {
	nodes := []*Node{}
	filter := textinput.New()
	filter.Placeholder = "Filter"
	filter.SetCursor(0)
	filter.Width = 20
	filter.Cursor.Blink = true
	filter.Cursor.Style = lipgloss.NewStyle().Foreground(theme.Blue)
	filter.Prompt = "|"
	filter.PlaceholderStyle = lipgloss.NewStyle().Foreground(theme.Overlay0).Background(theme.Mantle)
	filter.TextStyle = lipgloss.NewStyle().Foreground(theme.Blue).Background(theme.Mantle)

	t := newTableModel(nodes, objs)
	return &resultModel{
		focused: false,
		table:   t,
		width:   0,
		widthLimPB: progress.New(
			// ?: catppuccin "latte" yellow to blue,
			// HACK: with gradient does not support lipgloss.Color weird
			progress.WithGradient("#df8e1d", "#1e66f5"),
			progress.WithoutPercentage(),
			progress.WithSpringOptions(RESULT_PROGRESS_BAR_INIT_FREQ, RESULT_PROGRESS_BAR_CRITICAL_DAMP),
		),
		filter: filter,
	}
}

func (m *resultModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m *resultModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	// treat width limit bar's animation
	case progress.FrameMsg:
		pM, pCmd := m.widthLimPB.Update(msg)
		m.widthLimPB = pM.(progress.Model)
		cmds = append(cmds, pCmd)
	case resultMsg:
		log.Printf("resultMsg rendered")
		if msg.picked {
			m.setCandidate(nil)
		}

		if msg.picked && m.table.willOverWidth(msg.pickedNode) {
			return m, func() tea.Msg {
				return cancelPickMsg{
					canceled: true,
					node:     msg.pickedNode,
				}
			}
		}

		m.setTable(msg.nodes, msg.objs)
		cmds = append(cmds, m.setWidthLimitRatio())
	case candidateMsg:
		if m.table.willOverWidth(msg.candidate) {
			// do not render candidate
			return m, nil
		}
		m.setCandidate(msg.candidate)
	case tea.WindowSizeMsg:
		m.width = int(float64(msg.Width) * TABLE_WIDTH_RATIO) // TODO: rename TABLE_WIDTH_RATIO to result's
		tm, tCmd := m.table.Update(msg)
		m.table = tm.(*tableModel)
		cmds = append(cmds, tCmd)
	case tea.KeyMsg:
		if m.focused {
			fm, fCmd := m.filter.Update(msg)
			m.filter = fm
			m.table.setKeyword(m.filter.Value())
			cmds = append(cmds, fCmd)

			tm, tCmd := m.table.Update(msg)
			m.table = tm.(*tableModel)
			cmds = append(cmds, tCmd)
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *resultModel) View() string {
	return lipgloss.JoinVertical(lipgloss.Left,
		m.renderTopBar(),
		m.table.View(),
	)
}

// utils

func displayName(obj *unstructured.Unstructured) string {
	// TODO: gonna be namespace toggling feature
	// HACK: to reduce the width of table before viewport supporting horizontal scroll
	// if obj.GetNamespace() != "" {
	// 	return fmt.Sprintf("%s/%s", obj.GetNamespace(), obj.GetName())
	// }
	return obj.GetName()
}

func (m *resultModel) focus() tea.Cmd {
	m.focused = true

	m.filter.PromptStyle = lipgloss.NewStyle().Bold(true).Foreground(theme.Blue)
	return tea.Batch(
		textinput.Blink, // ???? not working
		m.filter.Focus(),
	)
}

// BUG: should blur when kbar rendered
// maybe mainmodel should have a tristate
func (m *resultModel) blur() {
	m.focused = false
	m.filter.PromptStyle = lipgloss.NewStyle().Foreground(theme.Overlay0)
	m.filter.Blur()
}

func GetNestedValueWithIndex(obj map[string]interface{}, fields ...string) (interface{}, bool, error) {
	var current interface{} = obj

	for i, field := range fields {
		// 숫자인지 확인 (배열 인덱스)
		if index, err := strconv.Atoi(field); err == nil {
			// 현재 값이 슬라이스인지 확인
			if slice, ok := current.([]interface{}); ok {
				if index >= len(slice) {
					return nil, false, fmt.Errorf("index %d out of bounds", index)
				}
				current = slice[index]
			} else {
				return nil, false, fmt.Errorf("expected array, got %T", current)
			}
		} else {
			// 맵인지 확인
			if m, ok := current.(map[string]interface{}); ok {
				var exists bool
				current, exists = m[field]
				if !exists {
					return nil, false, nil
				}
			} else {
				return nil, false, fmt.Errorf("expected map, got %T", current)
			}
		}

		// 마지막 필드면 현재 값 반환
		if i == len(fields)-1 {
			return current, true, nil
		}
	}

	return current, true, nil
}

func (m *resultModel) setTable(nodes []*Node, objs []*unstructured.Unstructured) {
	m.table.setObjs(objs)
	m.table.setNodes(nodes) // HACK: update ojbs first, setNodeMaxWidths is dependent on objs
}

func (m *resultModel) setCandidate(candidate *Node) {
	m.table.setCandidate(candidate)
}

func (m *resultModel) renderTopBar() string {
	// HACK: safe right padding required how much? idk
	// but 9 is safe where the point render 120 window width(result 80 width)
	// TODO: make 120 width as a hard lower limit of the program
	// pBarStyle := lipgloss.NewStyle()
	topBarStyle := lipgloss.NewStyle().Align(lipgloss.Right).Padding(0, 9, 0, 0).Width(m.width)

	return topBarStyle.Render(
		lipgloss.JoinHorizontal(lipgloss.Left,
			m.filter.View(),
			m.widthLimPB.View(),
		),
	)
}

func (m *resultModel) setWidthLimitRatio() tea.Cmd {
	var cmd tea.Cmd
	ratio := float64(m.table.tableWidth()) / float64(m.width)
	freq := RESULT_PROGRESS_BAR_INIT_FREQ * math.Log1p(1.0-ratio)
	m.widthLimPB.SetSpringOptions(freq, RESULT_PROGRESS_BAR_CRITICAL_DAMP)
	cmd = m.widthLimPB.SetPercent(ratio)

	return cmd
}
