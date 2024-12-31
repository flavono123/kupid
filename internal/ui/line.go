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
	if cursored {
		return l.cursorStyle(schemaBlurred).Render(">")
	}
	return l.cursorStyle(schemaBlurred).Render(" ")
}

func (l *Line) cursorStyle(schemaBlurred bool) lipgloss.Style {
	style := lipgloss.NewStyle().Foreground(theme.Blue).Bold(true)
	if schemaBlurred {
		style = style.Foreground(theme.Overlay0).Bold(false)
	}

	return style
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
