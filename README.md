# Kupid

![demo](./assets/kupid.gif)


Pick any Deep schema fields, create your own table view of Kubernetes TUI.

![GitHub License](https://img.shields.io/github/license/flavono123/kupid)
![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/flavono123/kupid)
[![Go Report Card](https://goreportcard.com/badge/github.com/flavono123/kupid)](https://goreportcard.com/report/github.com/flavono123/kupid)

## Installation

### Homebrew

```sh
brew install flavono123/tap/kupid

kupid
```

### Krew

```sh
# from the official krew index
kubectl krew install pickdeep  # more general name for this case; https://krew.sigs.k8s.io/docs/developer-guide/develop/naming-guide/

# from my custom krew index, more latest since follow this repo's package
kubectl krew index add flew https://github.com/flavono123/flew-index.git
kubectl krew install flew/pickdeep

kubectl pickdeep
```

### Go

```sh
go install github.com/flavono123/kupid/cmd/kupid@latest

kupid
```

## LIMITATION

- for kinds with more than 8000 schema fields, the program goes very slow down; i experienced with a 'Pod' with about 8000+ fields.
  - the bubbletea' viewport is not optimized for this case. should implement one for lazy loading of rendering content.

## Roadmap

- this is a dashboard only for read operations, NO writes
