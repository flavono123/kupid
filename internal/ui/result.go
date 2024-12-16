package ui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/kube"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type resultModel struct {
	table table.Model
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
	return &resultModel{
		table: table.New(table.WithColumns(cols), table.WithRows(rows)),
	}
}

func (m *resultModel) Init() tea.Cmd {
	return nil
}

func (m *resultModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case resultMsg:
		m.setTable(msg.fields, msg.objs, msg.add)
	}
	return m, nil
}

func (m *resultModel) View() string {
	return m.table.View()
}

// utils
func (m *resultModel) rows(fields []*kube.Field, objs []*unstructured.Unstructured) []table.Row {
	rows := []table.Row{}
	for _, obj := range objs {
		row := table.Row{}
		row = append(row, displayName(obj))
		for _, field := range fields {
			row = append(row, m.val(field, obj))
		}
		rows = append(rows, row)
	}
	return rows
}

func (m *resultModel) columns(fields []*kube.Field, rows []table.Row) []table.Column {
	cols := []table.Column{
		{
			Title: "Name",
			Width: maxColumnWidth("Name", rows, 0),
		},
	}
	for i, field := range fields {
		cols = append(cols, table.Column{
			Title: field.Name,
			Width: maxColumnWidth(field.Name, rows, i+1),
		})
	}
	return cols
}

func (m *resultModel) setTable(fields []*kube.Field, objs []*unstructured.Unstructured, add bool) {
	rows := m.rows(fields, objs)
	cols := m.columns(fields, rows)
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

func (m *resultModel) val(field *kube.Field, obj *unstructured.Unstructured) string {
	// TODO: treat deep pick for map[string]interface{}, array fields
	// TODO: map[string]interface{}: create children field(ui only) with unique set of resources' keys
	// TODO: array: create children field(ui only) with max length of resources' values
	// TODO: inject key or index among of path
	val, found, err := unstructured.NestedFieldNoCopy(obj.Object, field.FullPath()...)
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
