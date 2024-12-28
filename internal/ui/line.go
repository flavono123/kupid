package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/ui/theme"
)

type Line struct {
	node *Node

	style lipgloss.Style
	index int
	//cursored bool
}

func newLine(node *Node, width int, index int) *Line {
	style := lipgloss.NewStyle().MaxWidth(width)
	return &Line{node: node, style: style, index: index}
}

func (l *Line) render(leftPadding int, cursored bool, maxWidth int, schemaBlurred bool) string {
	line := lipgloss.JoinHorizontal(
		lipgloss.Left,
		l.number(leftPadding),
		l.indent(),
		l.cursor(cursored, schemaBlurred),
		l.action(),
		l.node.render(),
		// fmt.Sprintf("(%d)", l.node.Level()),
	)

	return lipgloss.NewStyle().MaxWidth(maxWidth).Render(line)
}

func (l *Line) number(leftPadding int) string {
	number := lipgloss.NewStyle().Foreground(theme.Overlay0)
	fmtStr := fmt.Sprintf("%%%dd ", leftPadding)
	return number.Render(fmt.Sprintf(fmtStr, l.index+1))
}

func (l *Line) indent() string {
	return strings.Repeat(" ", l.node.Level()*2)
}

func (l *Line) cursor(cursored bool, schemaBlurred bool) string {
	cursor := lipgloss.NewStyle().Foreground(theme.Blue).Bold(true)
	if schemaBlurred {
		cursor = cursor.Foreground(theme.Overlay0).Bold(false)
	}
	if cursored {
		return cursor.Render(">")
	}
	return cursor.Render(" ")
}

func (l *Line) action() string {
	action := lipgloss.NewStyle().Foreground(theme.Subtext1)
	if l.node.Foldable() {
		if l.node.Expanded {
			return action.Render("-")
		}
		return action.Render("+")
	} else {
		if l.node.Selected {
			return action.Render("◉")
		}
		return action.Render("○")
	}
}
