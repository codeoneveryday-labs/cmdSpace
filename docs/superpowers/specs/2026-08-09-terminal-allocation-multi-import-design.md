# Terminal Allocation and Multi-Session Import Design

## Goal

Make workspace setup show exactly how the selected terminal count is allocated among imported sessions, configured CLI agents, and ordinary shell terminals. Allow several native sessions to be selected in one import action.

## Allocation model

The workspace terminal count remains authoritative. Imported sessions and CLI agent counts consume terminal slots. Every unassigned slot becomes a regular terminal:

`regular = total - imported - CLI`

The UI presents this remainder explicitly as a read-only `Regular terminals` row. Existing CLI increment, quick-fill, and import capacity checks continue to prevent the assigned count from exceeding the total.

## Multi-session import

The setup dialog supports a multiple-selection mode. Clicking an available row toggles its selection, active Codex sessions remain disabled, and one footer action adds the selected sessions as a batch. The setup handler rejects duplicates and batches that exceed remaining capacity before mutating state, so partial imports cannot occur.

The existing-workspace import entry keeps its current single-session resume behavior.

## Verification

- Source tests assert the allocation row and multi-select controls are wired.
- Unit tests cover regular-terminal remainder calculation.
- Existing frontend tests, production build, Rust session-import tests, Cargo check, and Clippy remain green.
