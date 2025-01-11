package result

import (
	"log"
	"math"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/kube"
	"github.com/flavono123/kupid/internal/ui/event"
	"github.com/flavono123/kupid/internal/ui/result/table"
	"github.com/flavono123/kupid/internal/ui/theme"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	RESULT_PROGRESS_BAR_INIT_FREQ     = 120.0
	RESULT_PROGRESS_BAR_CRITICAL_DAMP = 1.0
	RESULT_WIDTH_RATIO                = table.TABLE_WIDTH_RATIO
)

type Model struct {
	focused bool // TODO: rename to focus
	table   *table.Model
	filter  textinput.Model

	width      int
	widthLimPB progress.Model
}

func NewModel(objs []*unstructured.Unstructured) *Model {
	nodes := []*kube.Node{}
	filter := textinput.New()
	filter.Placeholder = "Filter"
	filter.SetCursor(0)
	filter.Width = 20
	filter.Cursor.Style = lipgloss.NewStyle().Foreground(theme.Blue())
	filter.Prompt = "|"
	filter.PlaceholderStyle = lipgloss.NewStyle().Foreground(theme.Overlay0()).Background(theme.Mantle())
	filter.TextStyle = lipgloss.NewStyle().Foreground(theme.Blue()).Background(theme.Mantle())

	t := table.NewModel(nodes, objs)
	return &Model{
		focused: false,
		table:   t,
		width:   0,
		widthLimPB: progress.New(
			progress.WithGradient(theme.LatteYellow, theme.LatteBlue),
			progress.WithoutPercentage(),
			progress.WithSpringOptions(RESULT_PROGRESS_BAR_INIT_FREQ, RESULT_PROGRESS_BAR_CRITICAL_DAMP),
		),
		filter: filter,
	}
}

func (m *Model) Init() tea.Cmd {
	return textinput.Blink
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case progress.FrameMsg:
		pM, pCmd := m.widthLimPB.Update(msg)
		m.widthLimPB = pM.(progress.Model)

		cmds = append(cmds, pCmd)
	case event.TableUpdatedMsg:
		cmds = append(cmds, m.setWidthLimitRatio(msg.Width))
	case SetResultMsg:
		if msg.Picked {
			cmds = append(cmds, m.setCandidate(nil))
		}

		if msg.Picked && m.table.WillOverWidth(msg.PickedNode) {
			return m, func() tea.Msg {
				return event.CancelPickMsg{
					Canceled: true,
					Node:     msg.PickedNode,
				}
			}
		}

		cmds = append(cmds, m.setTable(msg.Nodes, msg.Objs))
		// cmds = append(cmds, m.setWidthLimitRatio())
	case SetTableCandidateMsg:
		cmds = append(cmds, m.setCandidate(msg.Candidate))
	case tea.WindowSizeMsg:
		m.setViewSize(msg)
	}

	if m.focused {
		fm, fCmd := m.filter.Update(msg)
		m.filter = fm
		if m.filter.Value() != m.table.Keyword() {
			cmds = append(cmds, m.setKeyword(m.filter.Value()))
		}
		cmds = append(cmds, fCmd)
	}

	tm, tCmd := m.table.Update(msg)
	m.table = tm.(*table.Model)
	cmds = append(cmds, tCmd)

	return m, tea.Batch(cmds...)
}

func (m *Model) View() string {
	return lipgloss.JoinVertical(lipgloss.Left,
		m.renderTopBar(),
		m.table.View(),
	)
}

func (m *Model) Focus() tea.Cmd {
	m.focused = true
	m.filter.PromptStyle = lipgloss.NewStyle().Bold(true).Foreground(theme.Blue())

	return m.filter.Focus()
}

func (m *Model) Focused() bool {
	return m.focused
}

// BUG: k put when show kbar in result tab should blur when kbar rendered
// maybe mainmodel should have a tristate
func (m *Model) Blur() {
	log.Println("Blurring resultModel")
	m.focused = false
	m.filter.PromptStyle = lipgloss.NewStyle().Foreground(theme.Overlay0())
	m.filter.Blur()
}

func (m *Model) setViewSize(msg tea.WindowSizeMsg) {
	m.width = int(float64(msg.Width) * RESULT_WIDTH_RATIO)
}

func (m *Model) setCandidate(candidate *kube.Node) tea.Cmd {
	return func() tea.Msg {
		return table.SetCandidateMsg{
			Candidate: candidate,
		}
	}
}

func (m *Model) setKeyword(keyword string) tea.Cmd {
	return func() tea.Msg {
		return table.SetKeywordMsg{
			Keyword: keyword,
		}
	}
}

func (m *Model) setTable(nodes []*kube.Node, objs []*unstructured.Unstructured) tea.Cmd {
	return func() tea.Msg {
		return table.SetTableMsg{
			Nodes: nodes,
			Objs:  objs,
		}
	}
}

func (m *Model) renderTopBar() string {
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

func (m *Model) setWidthLimitRatio(tableWidth int) tea.Cmd {
	var cmd tea.Cmd
	ratio := float64(tableWidth) / float64(m.width)
	freq := RESULT_PROGRESS_BAR_INIT_FREQ * math.Log1p(1.0-ratio)
	m.widthLimPB.SetSpringOptions(freq, RESULT_PROGRESS_BAR_CRITICAL_DAMP)
	cmd = m.widthLimPB.SetPercent(ratio)

	return cmd
}
