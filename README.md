# Kupid

demo here after release

Pick any Deep schema fields, create your own table view of Kubernetes TUI.

## Installation

### Homebrew

```sh
brew tap flavono123/tap
brew install kupid

kupid
```

### Krew

```sh
kubectl krew index add flew https://github.com/flavono123/flew-index.git
kubectl krew install flew/pickdeep

kubectl pickdeep # general name for this case; https://krew.sigs.k8s.io/docs/developer-guide/develop/naming-guide/
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
