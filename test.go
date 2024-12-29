package main

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/flavono123/kupid/internal/ui/theme"
	"github.com/sahilm/fuzzy"
)

func main() {
	data := []string{
		"kubernetes",
		"kubectl",
		"kubelet",
		"kubeadm",
		"kube-proxy",
		"kube-scheduler",
		"kube-controller-manager",
		"kube-apiserver",
		"etcd",
		"containerd",
	}

	matches := fuzzy.Find("ba", data)

	matched := map[int]fuzzy.Match{}
	for _, match := range matches {
		matched[match.Index] = match
	}

	for i, data := range data {
		if match, ok := matched[i]; ok {
			fmt.Println(highlight(data, match))
		} else {
			fmt.Println(data)
		}
	}
}

func highlight(s string, match fuzzy.Match) string {
	style := lipgloss.NewStyle().Foreground(theme.Blue)

	// 문자열을 루네로 변환하여 처리
	runes := []rune(s)
	result := make([]rune, 0, len(runes))

	for i, r := range runes {
		if contains(match.MatchedIndexes, i) {
			result = append(result, []rune(style.Render(string(r)))...)
		} else {
			result = append(result, r)
		}
	}

	return string(result) + fmt.Sprintf("(%d)", match.Score)
}

func contains(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}
