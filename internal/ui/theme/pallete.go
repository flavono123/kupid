package theme

import (
	catppuccin "github.com/catppuccin/go"
	"github.com/charmbracelet/lipgloss"
)

var theme = catppuccin.Mocha

var gradientFlavour = catppuccin.Latte

var (
	LatteYellow string = gradientFlavour.Yellow().Hex // gradient start
	LatteBlue   string = gradientFlavour.Blue().Hex   // gradient end
)

func Rosewater() lipgloss.Color { return lipgloss.Color(theme.Rosewater().Hex) }
func Flamingo() lipgloss.Color  { return lipgloss.Color(theme.Flamingo().Hex) }
func Pink() lipgloss.Color      { return lipgloss.Color(theme.Pink().Hex) }
func Mauve() lipgloss.Color     { return lipgloss.Color(theme.Mauve().Hex) }
func Red() lipgloss.Color       { return lipgloss.Color(theme.Red().Hex) }
func Maroon() lipgloss.Color    { return lipgloss.Color(theme.Maroon().Hex) }
func Peach() lipgloss.Color     { return lipgloss.Color(theme.Peach().Hex) }
func Yellow() lipgloss.Color    { return lipgloss.Color(theme.Yellow().Hex) }
func Green() lipgloss.Color     { return lipgloss.Color(theme.Green().Hex) }
func Teal() lipgloss.Color      { return lipgloss.Color(theme.Teal().Hex) }
func Sky() lipgloss.Color       { return lipgloss.Color(theme.Sky().Hex) }
func Sapphire() lipgloss.Color  { return lipgloss.Color(theme.Sapphire().Hex) }
func Blue() lipgloss.Color      { return lipgloss.Color(theme.Blue().Hex) }
func Lavender() lipgloss.Color  { return lipgloss.Color(theme.Lavender().Hex) }
func Text() lipgloss.Color      { return lipgloss.Color(theme.Text().Hex) }
func Subtext0() lipgloss.Color  { return lipgloss.Color(theme.Subtext0().Hex) }
func Subtext1() lipgloss.Color  { return lipgloss.Color(theme.Subtext1().Hex) }
func Overlay0() lipgloss.Color  { return lipgloss.Color(theme.Overlay0().Hex) }
func Overlay1() lipgloss.Color  { return lipgloss.Color(theme.Overlay1().Hex) }
func Overlay2() lipgloss.Color  { return lipgloss.Color(theme.Overlay2().Hex) }
func Surface0() lipgloss.Color  { return lipgloss.Color(theme.Surface0().Hex) }
func Surface1() lipgloss.Color  { return lipgloss.Color(theme.Surface1().Hex) }
func Surface2() lipgloss.Color  { return lipgloss.Color(theme.Surface2().Hex) }
func Base() lipgloss.Color      { return lipgloss.Color(theme.Base().Hex) }
func Mantle() lipgloss.Color    { return lipgloss.Color(theme.Mantle().Hex) }
func Crust() lipgloss.Color     { return lipgloss.Color(theme.Crust().Hex) }
