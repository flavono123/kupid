package ui

import (
	"fmt"
	"strconv"

	"github.com/charmbracelet/bubbles/progress"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type resultModel struct {
	focused bool
	table   *tableModel

	width      int
	widthLimPB progress.Model
	// widthLimitRatio float64
	wasPicked int
}

func newResultModel(objs []*unstructured.Unstructured) *resultModel {
	nodes := []*Node{}
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
			// more speed; default freq, damp is 6, 1(no damping)
			// TODO: crescendo freq dynamically for more picked like BALATRO
			progress.WithSpringOptions(120, 1.0),
		),
		wasPicked: 0,
	}
}

func (m *resultModel) Init() tea.Cmd {
	return nil
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
	// TODO: gonna be a toggling feature
	// HACK: to reduce the width of table before viewport supporting horizontal scroll
	// if obj.GetNamespace() != "" {
	// 	return fmt.Sprintf("%s/%s", obj.GetNamespace(), obj.GetName())
	// }
	return obj.GetName()
}

func (m *resultModel) focus() {
	m.focused = true
}

func (m *resultModel) blur() {
	m.focused = false
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

// TODO: move to table
func (m *resultModel) renderTopBar() string {
	// HACK: safe right padding required how much? idk
	// but 9 is safe where the point render 120 window width(result 80 width)
	// TODO: make 120 width as a hard lower limit of the program
	topBarStyle := lipgloss.NewStyle().Align(lipgloss.Right).Padding(0, 9, 0, 0).Width(m.width)

	return topBarStyle.Render(m.widthLimPB.View())
}

func (m *resultModel) setWidthLimitRatio() tea.Cmd {
	var cmd tea.Cmd
	// TODO: when it exceeds hard (or soft) limit, damping in current percent
	cmd = m.widthLimPB.SetPercent(float64(m.table.tableWidth()) / float64(m.width))

	return cmd
}
