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

#### Message System

- only root model can handle 'behavioral' messages(in package `event`) to set submodels
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
