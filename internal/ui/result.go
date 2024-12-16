package ui

import (
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
		m.setTable(msg.fields, msg.objs)
	}
	return m, nil
}

func (m *resultModel) View() string {
	return m.table.View()
}

// utils
func (m *resultModel) rows(_ []*kube.Field, objs []*unstructured.Unstructured) []table.Row {
	rows := []table.Row{}
	for _, obj := range objs {
		row := table.Row{}
		row = append(row, obj.GetName())
		// for _, field := range fields {
		// 	row = append(row, field.String(obj))
		// }
		rows = append(rows, row)
	}
	return rows
}

func (m *resultModel) columns(_ []*kube.Field, rows []table.Row) []table.Column {
	cols := []table.Column{
		{
			Title: "Name",
			Width: maxColumnWidth("Name", rows, 0),
		},
	}
	// for _, field := range fields {
	// 	cols = append(cols, table.Column{Title: field.Name})
	// }
	return cols
}

func (m *resultModel) setTable(fields []*kube.Field, objs []*unstructured.Unstructured) {
	rows := m.rows(fields, objs)
	cols := m.columns(fields, rows)
	m.table.SetRows(rows)
	m.table.SetColumns(cols)
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
