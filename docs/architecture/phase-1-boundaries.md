# Phase 1 Boundaries and Ownership Map

Date: 2026-08-11

This note makes the current subsystem seams explicit for Phase 1 scalability
work. It does not change behavior. It records where the interface for each
subsystem lives, who currently owns review routing, which state stays inside
the subsystem, and which focused tests already protect the seam.

Current repository authority exposes one CODEOWNERS handle: `@crynta`. Until
more reviewer handles are explicitly authorized, subsystem ownership means
location-based review routing plus a documented seam, not different GitHub
assignees.

## Global invariants

- The webview does not touch files, processes, or shells directly. Privileged
  behavior crosses the Tauri command seam.
- `src/app/App.tsx` stays the application coordinator, not the home for new
  domain state by default.
- Standard terminal panes and canvas terminals keep separate PTY/renderer
  lifecycles.
- `src-tauri/src/lib.rs` remains the single invoke boundary, even if command
  registration becomes more compositional later.

## Seam registry

| Subsystem | Primary surfaces | Current interface / seam | State owner | Existing focused proof |
| --- | --- | --- | --- | --- |
| App shell coordination | `src/app/App.tsx`, `src/modules/tabs`, `src/modules/shortcuts`, `src/modules/sidebar`, `src/modules/statusbar` | `App.tsx` composes module callbacks and passes application-level handlers down; `useTabs` is the tab/pane interface consumed by the shell | App-wide chrome state in `App.tsx`; tab/pane state in `useTabs` | `src/app/App.test.ts`, `src/modules/tabs/TabBar.test.ts` |
| Terminal / PTY | `src/modules/terminal`, `src-tauri/src/modules/pty` | `TerminalStack.tsx` + `PaneTreeView.tsx` render pane trees; `useTerminalSession.ts` owns the live PTY/session seam; Rust `pty::*` owns native session lifecycle | Live PTY session map in `useTerminalSession.ts`; pane tree in `useTabs`; native session/process state in `src-tauri/src/modules/pty` | `src/modules/terminal/TerminalStack.source.test.ts`, `src/modules/terminal/lib/panes.import.test.ts`, `src/modules/terminal/lib/osc-handlers.test.ts` |
| Canvas | `src/modules/architecture` | `ArchitectureCanvas.tsx` owns camera/pointer orchestration; `CanvasTerminalNode.tsx` owns canvas terminal lifecycle; `canvasWorkspacePersistence.ts` is the persistence seam | Diagram, dock layout, and camera state stay in the architecture module; each canvas terminal owns its own PTY | `src/modules/architecture/canvasWorkspacePersistence.test.ts`, `src/modules/architecture/ArchitectureCanvas.docking.source.test.ts`, `src/modules/architecture/CanvasTerminalNode.source.test.ts` |
| AI | `src/modules/ai` | `lib/native.ts` is the frontend-to-native bridge; tools expose the typed approval seam; session store and composer APIs are the caller-facing interface | Session/chat state in `store/chatStore.ts` and `lib/sessions.ts`; approval flow in `tools/` | `src/modules/ai/lib/security.test.ts`, `src/modules/ai/lib/sessions.source.test.ts`, `src/modules/ai/tools/orchestration.source.test.ts` |
| Editor / explorer | `src/modules/editor`, `src/modules/explorer` | Stack components mount editor/explorer surfaces; file mutations stay behind native helpers and existing module APIs | Editor tab state comes from `useTabs`; editor/explorer local UI state stays inside each module | `src/modules/editor/EditorStack.source.test.ts`, `src/modules/explorer/FileExplorer.source.test.ts` |
| Git / source control | `src/modules/git`, `src/modules/git-history`, `src/modules/source-control`, `src-tauri/src/modules/git` | Frontend panels consume git events/hooks; Rust git modules own process/parsing operations | Event bus and panel state stay in frontend git modules; command execution/parsing stay in Rust git modules | `src/modules/git/events.test.ts`, `src/modules/source-control/useSourceControl.source.test.ts` |
| Workspace / persistence | `src/modules/workspace`, `src/modules/workspaces`, `src/modules/tabs`, `src-tauri/src/modules/db.rs`, `src-tauri/src/modules/workspace.rs` | `useTabs` exposes tab/pane mutations; Rust db/workspace modules own durable storage and workspace loading | Workspace launch plans and pane records in SQLite; active UI workspace selection in `App.tsx`; tab/pane trees in `useTabs` | `src/app/App.test.ts`, `src/modules/workspaces/WorkspacesPanel.test.ts`, `src-tauri/src/modules/db.rs` tests |
| Remote access | `src/remote`, `src/modules/settings/remoteAccess.ts`, `src-tauri/src/modules/remote*` | Settings and remote UI consume a typed remote command/protocol seam; Rust remote modules own auth, protocol, and tunnel lifecycle | Remote client/UI state in `src/remote`; auth/tunnel state in Rust remote modules | `src/remote/protocol.test.ts`, `src/remote/remoteClient.test.ts`, `src-tauri/src/modules/remote_protocol_test.rs`, `src-tauri/src/modules/remote_tunnel_test.rs` |
| Release / platform | `src-tauri/src/lib.rs`, `src-tauri/capabilities`, `src/settings`, `.github/workflows` | `lib.rs` is the plugin/command registration seam; capabilities files are the permission contract | Native plugin registration and permission surface live under `src-tauri` | Repository checks plus targeted source tests when settings or capability surfaces change |

## Immediate extraction seams for later phases

These are the deepest next seams to cut without changing behavior in Phase 1:

1. `App.tsx` → extract workspace restore/persistence synchronization behind one
   module interface.
2. `TerminalStack.tsx` → separate pane-tree rendering from live PTY session
   lifecycle.
3. `ArchitectureCanvas.tsx` → separate camera/pointer logic from dock-layout
   and persistence operations.
4. `src-tauri/src/lib.rs` → group invoke registrations by domain with local
   command contract notes near each domain module.

## Review routing guidance

- Terminal lifecycle changes should touch `src/modules/terminal` and
  `src-tauri/src/modules/pty` together only when the seam truly changes.
- Canvas terminal work should stay inside `src/modules/architecture` unless a
  typed PTY contract must change.
- Workspace persistence changes should treat `useTabs` and Rust
  db/workspace modules as the seam pair to review together.
- Filesystem, shell, network, secrets, and capability changes remain native
  security-sensitive surfaces even if the frontend change appears small.

## Phase 1 exit criteria

Phase 1 is doing its job when:

- contributors can identify the seam before editing;
- review routing follows subsystem paths instead of one wildcard owner rule;
- hub files remain mostly wiring surfaces; and
- later extraction work can point to a named seam and an existing proof file.
