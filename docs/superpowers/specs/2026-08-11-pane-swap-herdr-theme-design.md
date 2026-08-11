# Terminal pane swapping and Herdr host theme reporting

## Outcome

Dragging a terminal header onto another terminal swaps the two pane positions
without recreating either PTY/session. Herdr sessions can follow cmdSpace's
light/dark appearance when Herdr's own `theme.auto_switch` is enabled.

## Design

### Pane swap

- The existing `PaneNode` tree remains the source of truth.
- Add a pure `swapLeafNodes(tree, sourceId, targetId)` helper that exchanges
  the complete leaf nodes, including their position-local `size` values. IDs
  move with the terminal session, so PTY handles, metadata, cwd, and command
  state remain attached to the correct terminal.
- `PaneTreeView` owns pointer drag state for a leaf header. The header is the
  grab handle; the xterm surface and control buttons are not draggable.
- During a drag, the source header is muted and the current leaf target gets a
  visible drop outline. Pointer cancel, Escape, blur, and drops outside a leaf
  cancel without changing the tree.
- On a valid same-tab leaf drop, call `onPaneTreeChange(swapLeafNodes(...))`
  and focus the terminal now occupying the source position.

### Herdr theme reporting

- Do not write or rewrite Herdr's config file.
- Preserve xterm's OSC 10/11 query handling so the renderer emits the current
  cmdSpace terminal palette.
- Forward those OSC color-report responses only when the session's detected
  CLI is Herdr; continue dropping them for ordinary shells to avoid polluting
  shell input/history.
- Herdr users enable its documented `[theme] auto_switch = true` setting;
  Herdr then selects its configured `light_name`/`dark_name` based on the host
  palette reports.

## Non-goals

- Reordering panes across tabs.
- Swapping split containers or changing split direction.
- Editing `~/.config/herdr/config.toml`.
- Adding a new drag-and-drop dependency.

## Verification

- Unit tests cover pure tree swaps, nested splits, missing IDs, and no-op same
  ID behavior.
- Source tests cover header drag affordances, cancellation paths, target
  highlighting, and Herdr-only OSC forwarding.
- Run focused Vitest tests, full Vitest, `pnpm build`, and `git diff --check`.
