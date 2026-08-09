# Menu Bar Workspace Switcher Design

Date: 2026-08-09

## Outcome

cmdSpace exposes a macOS menu bar icon. Clicking the icon opens a compact,
borderless workspace switcher below it. The switcher lists every persisted
workspace, supports search and keyboard navigation, and opens the selected
workspace in the main cmdSpace window.

## Product Behavior

- The cmdSpace icon is always visible in the macOS menu bar while the app runs.
- A left click toggles a single workspace-switcher window positioned below the
  icon and clamped to the active display.
- Every open refreshes the workspace list from the existing SQLite command.
- Search matches workspace name and working folder, case-insensitively.
- Up/Down changes the active row, Enter opens it, and Escape closes the popup.
- Selecting a row restores, shows, and focuses the main window, then delegates
  workspace activation to the existing `App.tsx` workspace-selection path.
- The popup hides when it loses focus.
- Standard and canvas workspaces use distinct existing terminal/canvas icons.

## Architecture

The native layer owns the tray icon, popup window lifecycle, screen placement,
and main-window activation. A dedicated `tray.html` Vite entry renders a small
React UI and reads the canonical SQLite workspace list through
`db_list_workspaces`. It invokes native commands only to hide the popup or open
a workspace.

The main window listens for `cmdspace:open-workspace` and calls the existing
`handleSelectWorkspace` callback. This preserves standard/canvas workspace
restoration and avoids duplicating tab or pane state.

## Scope Boundaries

- macOS is the supported tray interaction target for this iteration.
- No new persistence schema or dependency is introduced.
- No terminal, canvas PTY, or workspace creation behavior changes.
- The app remains a normal Dock app; this does not convert it into an
  accessory-only menu bar application.

## Validation

- Pure frontend tests cover filtering and keyboard selection helpers.
- Rust tests cover popup placement and display-edge clamping.
- Source-contract tests cover the Vite entry, Tauri capability, tray wiring,
  SQLite refresh, blur close, and main-window event handoff.
- The production frontend build, focused Vitest suite, Rust tests, Cargo check,
  and Clippy must pass.
