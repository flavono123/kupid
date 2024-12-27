package ui

import (
	"fmt"
	"strconv"

	tea "github.com/charmbracelet/bubbletea"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type resultModel struct {
	focused bool
	table   *tableModel
}

func newResultModel(objs []*unstructured.Unstructured) *resultModel {
	headers := []string{"Name"}
	rows := [][]string{}
	for _, obj := range objs {
		rows = append(rows, []string{obj.GetName()})
	}

	t := newTableModel(headers, rows)
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
	// case resultMsg:
	// 	// TODO: implement
	// 	// m.setTable(msg.nodes, msg.objs, msg.add)
	case tea.WindowSizeMsg:
		tm, tCmd := m.table.Update(msg)
		m.table = tm.(*tableModel)
		cmds = append(cmds, tCmd)
	case tea.KeyMsg:
		// TODO: cursor movement
		if m.focused {
			tm, tCmd := m.table.Update(msg)
			m.table = tm.(*tableModel)
			cmds = append(cmds, tCmd)
		}
	}
	return m, tea.Batch(cmds...)
}

func (m *resultModel) View() string {
	return m.table.View()
}

// utils

// TODO: rename or move to proper module/method
func (m *resultModel) val(node *Node, obj *unstructured.Unstructured) string {
	val, found, err := GetNestedValueWithIndex(obj.Object, node.NodeFullPath()...)
	if err != nil || !found {
		return "-"
	}

	if str, ok := val.(string); ok && len(str) == 0 { // edge case `""`
		return "\"\""
	}

	return fmt.Sprintf("%v", val)
}

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
