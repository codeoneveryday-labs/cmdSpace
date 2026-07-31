# US-024 Shared Terminal Navigation and Canvas Lock

## Status

in-progress

## Lane

normal

## Product Contract

Canvas terminal nodes and the Cmd+I bottom terminal expose the same quick
directory and Git branch controls as a standard terminal pane. A canvas
terminal also exposes Cate-style layout locking from its header.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`
- `docs/product/shell-overlays.md`

## Acceptance Criteria

- Selecting a folder in either surface writes a quoted `cd` command to that
  surface's isolated PTY.
- Selecting a branch checks it out in the resolved repository and refreshes
  other terminal branch labels through the existing git-change event.
- The development-repository checkout guard remains in effect.
- A canvas terminal header has an accessible Lock/Unlock control that persists
  the existing `locked` node property and prevents canvas layout edits only.

## Design Notes

- Extract the folder/branch UI from `FloatingTerminalOverlay` into a shared
  terminal-header control; keep each terminal's PTY lifecycle local.
- Reuse `native.gitResolveRepo`, `native.runCommand`, `list_subdirs`, and the
  existing git-change event rather than introducing a second git API.
- Lock semantics match Cate's `isPinned`: input is still usable, while moving,
  resizing, and deletion remain blocked by `ArchitectureCanvas`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Source tests assert shared navigation and lock wiring |
| Integration | Canvas and drawer source tests pass |
| E2E | Not run: user requested no direct app testing |
| Platform | `pnpm build` passes |

## Delivery

- [x] Shared terminal folder and branch controls
- [x] Canvas and Cmd+I isolated-PTY navigation wiring
- [x] Canvas terminal layout Lock/Unlock action
- [x] Build and full focused verification
| Release | Not applicable |

## Harness Delta

The checked-in Harness binary is unavailable at `scripts/bin/harness-cli`, so
the required durable intake/trace commands cannot run in this checkout.

## Evidence

Pending implementation verification.
