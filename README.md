# Kattle

Pick any Deep schema fields, create your own table view of Kubernetes TUI.

![GitHub License](https://img.shields.io/github/license/flavono123/kattle?colorA=363a4f&colorB=b7bdf8)
![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/flavono123/kattle?colorA=363a4f&colorB=f5a97f)
[![Go Report Card](https://img.shields.io/badge/go%20report-A+-brightgreen?colorA=363a4f&colorB=a6da95)](https://goreportcard.com/report/github.com/flavono123/kattle)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?colorA=363a4f&colorB=7dc4e4)](https://github.com/flavono123/kattle/issues)

## Installation

### Homebrew

```sh
brew install flavono123/tap/kupid

kupid
```

### Krew

> [!NOTE]
> for a krew plugin, named as `pickdeep`  over `kupid` to follow the [krew's naming guide](https://krew.sigs.k8s.io/docs/developer-guide/develop/naming-guide/).

```sh
# from the official krew index
kubectl krew install pickdeep

# from my custom krew index, the most latest
kubectl krew index add flew https://github.com/flavono123/flew-index.git
kubectl krew install flew/pickdeep

kubectl pickdeep
```

### Go

```sh
go install github.com/flavono123/kattle/cmd/kupid@latest

kupid
```

## LIMITATION

> [!WARNING]
> for kinds with more than 8000 schema fields, the program goes very slow down; i experienced with a 'Pod' with about 8000+ fields.
> the bubbletea' viewport is not optimized for this case. should implement one for lazy loading of rendering content.

## Roadmap

- this is a dashboard only for read operations, NO writes
