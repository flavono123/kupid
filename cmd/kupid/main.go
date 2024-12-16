package main

import (
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/ui"
)

func main() {
	program := tea.NewProgram(
		ui.InitModel(),
		tea.WithAltScreen(),
	)
	if _, err := program.Run(); err != nil {
		log.Fatalf("failed to run program: %v", err)
		os.Exit(1)
	}
}
