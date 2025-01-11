# Kupid

> i gave a second chance to kube..pid

Pick any Deep schema field, create your own table view Kubernetes TUI.

Disclaimer:
This project is alpha stage for now.

\<Demo after beta release\>

## Architecture

### Kubernetes Client([kube/](./kube/))

- parse openapiv3 intial schema(fields) of a gvr, copy behavior of kubectl explain

### UI([ui/](./ui/))

- use bubbletea, components are communicate with its message system
  - handling messages are should be in model's package(case of `msg.(type)`)
  - do not expose setters of component(model) is default, send message to it to update itself
  - setters are should be called in model's Update()
- models
  - implementaion of bubbletea model interface(Init, Update, View)
  - defined in a model.go file
    - have own messages(see details in [Message System](#message-system))
      - only root has seperated package name `event` (to avoid circular dependencies)
      - the other submodels' are in for each msg.go file
    - have own keymaps in the keymap.go file
  - root is in ui/
  - submodels are in ui/*
- components
  - rendered by model's View()
    - no need to define bubbletea model's interface
    - no messages
    - use 'render*' over view to naming functions
  - defined with its named file(e.g. table.go)

#### Message System

- only root model(ui/) can handle 'behavioral' messages(in package `event`) to set submodels(ui/*)
  - returns Set*Msg of submodel


## Manual Test List

- tab
- kbar
  - focused on schema
  - focused on result; k stroke bug is
  - search and select new gvk
- schema
  - expand/collapse; move back when collapsed from level, all expand
  - pick/unpick
  - update schema; new annotation, deleted label key, ... X
- result
  - filter; should not be focused when kbar up
  - candidate on hover
  - pick limit
  - progressbar animation

## Limitation

- NO write operations; except this followings are "not yet"
- multi contexts
- multi namespaces
