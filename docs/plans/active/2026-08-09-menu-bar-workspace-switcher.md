# Execution Plan: Menu Bar Workspace Switcher

Date: 2026-08-09

## Status

Completed

## Outcome

Clicking the cmdSpace macOS menu bar icon opens a searchable popup containing
all SQLite-backed workspaces; selecting one focuses cmdSpace and opens exactly
that workspace.

## Context

- Approved design: `docs/superpowers/specs/2026-08-09-menu-bar-workspace-switcher-design.md`
- Native app/window wiring: `src-tauri/src/lib.rs`
- Workspace persistence: `src-tauri/src/modules/db.rs`
- Workspace activation authority: `src/app/App.tsx`
- Existing workspace icon language: `src/modules/workspaces/WorkspacesPanel.tsx`

## Scope

In scope:

- macOS tray icon and borderless popup window.
- SQLite refresh, search, keyboard navigation, and workspace selection.
- Correct main-window activation for standard and canvas workspaces.
- Production build and cross-platform compile safety.

Out of scope:

- Removing the Dock icon or converting cmdSpace to a menu-bar-only app.
- Windows/Linux tray interaction behavior.
- Workspace CRUD inside the popup.

## Approach

1. Add failing pure/helper and source-contract tests.
2. Add the dedicated tray React/Vite entry and accessible switcher UI.
3. Add macOS Tauri tray/window lifecycle and placement logic.
4. Connect native workspace selection to the existing main-app callback.
5. Run focused and repository-required validation.

## Risks And Recovery

- Multi-monitor scale/edge placement: convert Tauri tray geometry to logical
  coordinates and clamp to the monitor work area; cover the math with tests.
- Main-window state duplication: emit an ID and reuse `handleSelectWorkspace`.
- Cross-platform CI: keep macOS-specific tray code behind `cfg(target_os =
  "macos")` and run all-target Cargo checks.
- Recovery: revert only the new tray entry, commands, setup hook, capabilities,
  and main-window listener; no database migration is involved.

## Progress

- [x] Lock behavior with failing tests.
- [x] Implement popup frontend and workspace helpers.
- [x] Implement macOS tray lifecycle and window placement.
- [x] Connect main-window workspace activation.
- [x] Complete focused and repository-wide validation.

## Decisions

- 2026-08-09: Reuse the bundled cmdSpace icon as an AppKit template image to
  follow macOS light/dark menu bar rendering without another asset pipeline.
- 2026-08-09: Refresh via `db_list_workspaces` on every open so SQLite remains
  the source of truth in production.
- 2026-08-09: Keep the app in the Dock; the requested menu bar switcher is an
  additional fast entry point, not a lifecycle change.

## Validation

- Focused proof: tray helper/source Vitest tests and Rust placement tests.
- Integration or end-to-end proof: production Vite build and Tauri compile.
- Repository-required checks: `cargo check --all-targets --locked`, Clippy,
  `git diff --check`.

## Result

Implemented a macOS template tray icon, a searchable SQLite-backed workspace
popup, keyboard navigation, multi-display clamping, blur-to-close behavior, and
main-window workspace handoff. The same delivery also expands native CLI session
discovery and enabled-provider filtering.

Verified with 470 frontend tests, a production frontend build containing
`dist/tray.html`, 164 Rust tests, focused tray/session tests, Cargo check, and
Clippy with warnings denied. Manual inspection confirmed the menu bar icon is
present; popup visual fidelity remains a post-install smoke-test item because
the desktop automation could not target the macOS status item reliably.
