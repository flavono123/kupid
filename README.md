# Kupid

demo here after release

Pick any Deep schema fields, create your own table view of Kubernetes TUI.

## Installation

### Homebrew

tbd

### Krew



### Go

```sh
go install github.com/flavono123/kupid/cmd/kupid@latest
```

## LIMITATION

- for kinds with more than 8000 schema fields, the program goes very slow down; i experienced with a 'Pod' with about 8000+ fields.
  - the bubbletea' viewport is not optimized for this case. should implement one for lazy loading of rendering content.

## Roadmap

- this is a dashboard only for read operations, NO writes
