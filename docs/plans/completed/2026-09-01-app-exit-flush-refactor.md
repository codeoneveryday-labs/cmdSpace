# App exit flush and native window lifecycle

## Outcome

Closing the Settings window must never shut down the main cmdSpace process. A
real app quit (Cmd+Q, native Quit, or main-window close) must flush every
workspace pane/session mapping before exit, with a bounded 1–2 second fallback.

## Current evidence

- `src-tauri/src/lib.rs:225-400` owns native menu setup and repeats exit logic
  in custom Quit, `on_window_event`, and `RunEvent::ExitRequested`.
- The current `on_window_event` callback is attached to every Tauri window, so
  closing the dynamically-created `settings` window can enter app shutdown.
- `src/app/lib/useWorkspacePaneSessionSync.ts` flushes pane reconciliation but
  its no-argument path must cover every loaded workspace, not only workspaces
  with pending timers.
- `src/app/lib/useAppWindowEvents.ts` owns the frontend flush listener and the
  visual saving state in `src/app/App.tsx`.

## Design

1. Add one native exit coordinator (new `src-tauri/src/app_exit.rs`, or an
   equivalent module under `window_commands`) with an explicit state machine:
   `Idle -> Flushing -> Exiting`. It emits `cmdspace:exit-requested` once,
   accepts a frontend `cmdspace:exit-flush-complete` acknowledgement, and has
   a 1.5–2.0 second timeout fallback.
2. Route the macOS Quit menu, `RunEvent::ExitRequested`, and the main-window
   `CloseRequested` event through that coordinator. Filter window events to the
   `main` label; Settings/workspace-switcher closes remain local window closes.
3. Move menu construction out of `lib.rs`. Replace order/text-based removal
   (`remove_at(0)`, `starts_with("Quit")`) with stable menu item identity and a
   single custom Quit action.
4. Have the frontend listener call the existing all-workspace flush, then invoke
   or emit the completion acknowledgement. Keep the saving overlay visible
   until acknowledgement/exit; preserve a bounded timeout for native recovery.
5. Keep `run()` as the composition root: initialize DB/state, register modules,
   install the exit coordinator/menu, and start the Tauri event loop.

## Acceptance criteria

- Closing Settings leaves the main process and main window alive.
- Closing any non-main auxiliary window never emits `cmdspace:exit-requested`.
- Cmd+Q and native Quit emit exactly one exit request, flush all loaded
  workspaces, and exit after the frontend ack; the fallback exits within 2.0s if
  the frontend is unavailable.
- Main-window close follows the same path and cannot bypass the flush.
- A workspace pane/session mapping written immediately before quit remains in
  SQLite after reopening the app.
- Rust unit tests cover coordinator transitions and main-window filtering;
  Vitest tests cover the frontend acknowledgement and all-workspace flush.
- `cargo check --all-targets --locked`, focused Vitest, `pnpm exec tsc --noEmit`,
  `pnpm build`, and a manual macOS packaged-app test pass.

## Implementation steps

1. Add failing Rust/frontend tests for auxiliary-window close, duplicate exit
   requests, ack-before-timeout, timeout fallback, and all-workspace flush.
2. Implement the coordinator and stable menu wiring; remove duplicated exit
   branches from `src-tauri/src/lib.rs`.
3. Add the frontend completion acknowledgement and ensure flush errors still
   resolve the exit path without silently skipping the saving overlay.
4. Run focused tests, typecheck, Rust checks, and packaged macOS verification.
5. Review the final diff for unrelated changes, then move this plan to
   `docs/plans/completed/` only after all acceptance criteria pass.

## Risks and mitigations

- macOS may deliver Quit through a native menu path distinct from window close;
  test both paths and keep the `RunEvent` fallback.
- Auxiliary windows may be created dynamically; identify them by stable labels
  and filter the coordinator to `main`.
- A frontend acknowledgement can be lost during renderer failure; use the
  bounded native timeout and report the timeout in logs.
- Re-entrant close events can schedule multiple exits; centralize the atomic
  state transition and test it.
