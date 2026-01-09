package nav

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/flavono123/kattle/internal/kube"
	"github.com/flavono123/kattle/internal/ui/theme"
)

// TODO: function args node(s) under ui should be line and get the node from getter
type Line struct {
	node *kube.Node
	objs []*unstructured.Unstructured

	style lipgloss.Style
	index int
}

func newLine(node *kube.Node, width int, index int, objs []*unstructured.Unstructured) *Line {
	style := lipgloss.NewStyle().MaxWidth(width)
	return &Line{node: node, style: style, index: index, objs: objs}
}

func (l *Line) render(leftPadding int, cursored bool, maxWidth int, schemaBlurred bool) string {
	line := lipgloss.JoinHorizontal(
		lipgloss.Left,
		l.number(leftPadding),
		l.indent(),
		l.cursor(cursored, schemaBlurred),
		l.action(),
		l.renderNode(),
	)

	return lipgloss.NewStyle().MaxWidth(maxWidth).Render(line)
}

func (l *Line) renderNode() string {
	name := lipgloss.NewStyle().Foreground(theme.Green())
	displayType := lipgloss.NewStyle().Foreground(theme.Peach())

	if l.node.Type() == "" {
		return name.Render(l.node.Name())
	}

	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		name.Render(l.node.Name()),
		displayType.Render(fmt.Sprintf("<%s>", l.node.Type())),
	)
}

func (l *Line) number(leftPadding int) string {
	number := lipgloss.NewStyle().Foreground(theme.Overlay0())
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
	style := lipgloss.NewStyle().Foreground(theme.Blue()).Bold(true)
	if schemaBlurred {
		style = style.Foreground(theme.Overlay0()).Bold(false)
	}

	return style
}

func (l *Line) action() string {
	action := lipgloss.NewStyle().Foreground(theme.Subtext1())
	if l.node.Foldable() {
		if l.node.Expanded {
			return action.Render("-")
		}
		return action.Render("+")
	} else if l.node.Pickable(l.objs) {
		if l.node.Selected {
			return action.Render("◉")
		}
		return action.Render("○")
	}

	// HACK: this would not be rendered
	// see Model.buildLines
	return action.Render(" ")
}
