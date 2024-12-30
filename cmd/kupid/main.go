package main

import (
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/flavono123/kupid/internal/ui"
)

func main() {
	if len(os.Getenv("DEBUG")) > 0 {
		f, err := tea.LogToFile("debug.log", "debug")
		if err != nil {
			log.Fatalf("failed to log to file: %v", err)
			os.Exit(1)
		}
		defer f.Close()
	}

	program := tea.NewProgram(
		ui.InitModel(),
		tea.WithAltScreen(),
	)

	if _, err := program.Run(); err != nil {
		log.Fatalf("failed to run program: %v", err)
		os.Exit(1)
	}
}
