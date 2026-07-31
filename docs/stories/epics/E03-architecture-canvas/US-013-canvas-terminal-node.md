# US-013 — Add an independent terminal node to the architecture canvas

## User story

As a developer, I want to place a real terminal on the architecture canvas so I can run commands beside the diagram without sharing the lifecycle of terminal panes.

## Acceptance criteria

- The toolbar slot previously labelled `Image` creates a `Terminal` node and keeps the `I` shortcut.
- A terminal node can be dragged and resized like other canvas nodes.
- Each node owns its own PTY and xterm renderer; it does not use `TerminalPane`, the pane session pool, or an existing terminal leaf.
- The node persists position, dimensions, label, and the latest working directory in the architecture diagram.
- Reopening/remounting the canvas creates a new shell using the saved working directory.
- Deleting a node or clearing the canvas closes its PTY.
- Existing `image` nodes remain valid and renderable, but Image is no longer offered by the toolbar.

## Verification

- Architecture source/render tests cover terminal mode, legacy image compatibility, and isolated PTY ownership.
- TypeScript compilation passes.
