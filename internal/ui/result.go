package ui

import (
	"fmt"
	"strconv"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type resultModel struct {
	focused bool
	table   table.Model
}

func newResultModel(objs []*unstructured.Unstructured) *resultModel {
	rows := []table.Row{}
	for _, obj := range objs {
		rows = append(rows, table.Row{obj.GetName()})
	}
	cols := []table.Column{
		{
			Title: "Name",
			Width: maxColumnWidth("Name", rows, 0),
		},
	}
	t := table.New(
		table.WithColumns(cols),
		table.WithRows(rows),
		table.WithFocused(false),
	)
	return &resultModel{
		focused: false,
		table:   t,
	}
}

func (m *resultModel) Init() tea.Cmd {
	return nil
}

func (m *resultModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case resultMsg:
		m.setTable(msg.nodes, msg.objs, msg.add)
	case tea.KeyMsg:
		if m.focused {
			tm, tCmd := m.table.Update(msg)
			m.table = tm
			cmds = append(cmds, tCmd)
		}
	}
	return m, tea.Batch(cmds...)
}

func (m *resultModel) View() string {
	return m.table.View()
}

// utils
func (m *resultModel) rows(nodes []*Node, objs []*unstructured.Unstructured) []table.Row {
	rows := []table.Row{}
	for _, obj := range objs {
		row := table.Row{}
		row = append(row, displayName(obj))
		for _, node := range nodes {
			row = append(row, m.val(node, obj))
		}
		rows = append(rows, row)
	}
	return rows
}

func (m *resultModel) columns(nodes []*Node, rows []table.Row) []table.Column {
	cols := []table.Column{
		{
			Title: "Name",
			Width: maxColumnWidth("Name", rows, 0),
		},
	}
	for i, node := range nodes {
		cols = append(cols, table.Column{
			Title: node.Name(),
			Width: maxColumnWidth(node.Name(), rows, i+1),
		})
	}
	return cols
}

func (m *resultModel) setTable(nodes []*Node, objs []*unstructured.Unstructured, add bool) {
	rows := m.rows(nodes, objs)
	cols := m.columns(nodes, rows)
	if add {
		m.table.SetColumns(cols)
		m.table.SetRows(rows)
	} else {
		m.table.SetRows(rows)
		m.table.SetColumns(cols)
	}
}

func maxColumnWidth(title string, rows []table.Row, col int) int {
	max := len(title)
	for _, row := range rows {
		if len(row[col]) > max {
			max = len(row[col])
		}
	}
	return max
}

func (m *resultModel) val(node *Node, obj *unstructured.Unstructured) string {
	// TODO: treat deep pick for map[string]interface{}, array fields
	// TODO: map[string]interface{}: create children field(ui only) with unique set of resources' keys
	// TODO: array: create children field(ui only) with max length of resources' values
	// TODO: inject key or index among of path
	val, found, err := GetNestedValueWithIndex(obj.Object, node.NodeFullPath()...)
	if err != nil {
		return "-"
	}
	if !found {
		return "-"
	}
	return fmt.Sprintf("%v", val)
}

func displayName(obj *unstructured.Unstructured) string {
	if obj.GetNamespace() != "" {
		return fmt.Sprintf("%s/%s", obj.GetNamespace(), obj.GetName())
	}
	return obj.GetName()
}

func (m *resultModel) focus() {
	m.focused = true
	m.table.Focus()
}

func (m *resultModel) blur() {
	m.focused = false
	m.table.Blur()
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
