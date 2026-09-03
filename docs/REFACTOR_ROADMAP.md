# cmdSpace Refactor Roadmap

Updated: 2026-08-31

Scale-readiness assessment and the staged hardening plan now live in
[`docs/architecture/scale-readiness.md`](architecture/scale-readiness.md) and
[`docs/plans/active/2026-08-31-architecture-scale-hardening.md`](plans/active/2026-08-31-architecture-scale-hardening.md).
The current evidence and deliberately open decisions are summarized in
[`docs/reports/2026-08-31-refactor-completion-audit.md`](reports/2026-08-31-refactor-completion-audit.md).

## Purpose

This document records the current code-size audit and the recommended order for
future refactors. Line counts are approximate source LOC from the current
worktree and exclude dependency/vendor output, `dist`, and Rust `target` files.
Large files are not automatically bad: generated catalogs and intentional state
machines should not be split merely to reduce a number.

## Current state

- Release HEAD: `v0.7.101` (`27e6fb39`).
- `src/app/App.tsx` has already been decomposed into workspace, layout, surface,
  selection, terminal-action, and pane-action seams.
- `src-tauri/src/lib.rs` has already been reduced to a composition root; command
  registration lives in `src-tauri/src/commands.rs` and window/tray commands
  live in `src-tauri/src/window_commands.rs`.
- The current worktree is not clean. Existing changes include the resident
  agent-chat daemon work and a pre-existing `.commandcode/settings.json`
  modification. Do not overwrite or reset those changes.
- No new dependency should be introduced for the refactors below.
- Remote decomposition is complete: `remote.rs` is now an 85-line facade
  with tested production seams under `src-tauri/src/modules/remote/` and
  compatibility command adapters in `src-tauri/src/modules/remote_commands.rs`.
- Database decomposition is complete: `db.rs` is now a 117-line facade
  with model, schema, workspace, recent, agent-chat, and test seams.
- Agent-usage command wiring is now a 114-line facade; filesystem/database
  scanning and provider parsing live in `src-tauri/src/modules/agent_usage_scan.rs`,
  while the Command Code quota adapter lives in
  `src-tauri/src/modules/agent_command_code_usage.rs`.
- PTY module wiring is now a 22-line
  `src-tauri/src/modules/pty/mod.rs`; state registry lives in
  `src-tauri/src/modules/pty_state.rs`, CLI discovery and WSL probing live in
  `src-tauri/src/modules/pty/cli_probe.rs`, and Tauri command adapters live in
  `src-tauri/src/modules/pty_commands.rs`.
- Explorer mutation orchestration is now isolated in
  `src/modules/explorer/lib/fileTreeMutations.ts`, with direct ordering and
  refresh tests; `useFileTree.ts` retains React loading/state ownership and
  the existing native bridge contract.
- Database initialization now exposes an in-memory-testable
  `initialize_schema(&Connection)` seam while retaining the existing additive
  column-probing migration strategy. Do not introduce `user_version` without
  an ADR defining recovery and the historical-version baseline.
- Platform validation remains open: host macOS checks pass, but the installed
  Windows MSVC Rust target cannot compile C dependencies from macOS without a
  Windows SDK toolchain. Treat Windows/WSL runtime behavior as unverified
  until it is checked from a Windows/MSVC environment.
- Native speech sessions are now fenced by lifecycle identity: macOS
  rechecks buffered level/result/error callbacks on the main thread and
  Windows gates buffered stdout by active session id. Stale callbacks cannot
  mutate a replacement session; a bundled macOS microphone smoke test and a
  real Windows/MSVC smoke test remain required.
- Agent Chat now finalizes unexpected persistent Codex/OMP exits without
  kill/wait, preserves resident Claude/Print runtimes after per-turn exit, and
  re-admits a stale attached UI session once without changing `agent_chat_*`
  wire names. Attach/start now return an opaque attachment token, and detach
  only acts when `chatId`, `sessionId`, and that token still match; stale
  cleanup cannot detach a newer channel.
- The frontend CI job runs `pnpm test` in addition to type-check and build.
- Explorer directory reads now use a pure per-path/tree-generation fence, so
  an old `fs_read_dir` result cannot overwrite a newer refresh or a reset
  workspace tree. `useFileTree` remains the sole lifecycle and native-bridge
  owner.
- Agent Chat runtime status now reports the latest cold-start and warm-attach
  durations after successful starts. Use those measurements from actual
  provider runs before reconsidering the global start gate or residency model.
- Agent Chat composer voice-draft policy now lives in the direct-tested
  `agentChatPromptModel`; its workspace source contract protects composition
  ownership instead of scanning unrelated child implementation strings.
- Voice transcript insertion now lives in the direct-tested
  `voiceTranscriptInsertionModel`; the React hook keeps only state/timer
  ownership and forwards the literal transcript to the captured terminal.
- Remote session selection and bounded create retry now live in the
  direct-tested `remoteSessionLifecycleModel`; `RemoteApp` retains WebSocket,
  timer, and UI ownership.
- Native device pairing URL construction now lives in the direct-tested
  `buildNativeDevicePairingUrl` Adapter; Settings retains the pairing UI and
  remote-device command ownership.
- Native autostart synchronization and toggling now live in the direct-tested
  `autostartPreferenceAdapter`; Settings retains UI errors and unmount
  lifecycle ownership.
- Terminal pane header drag/reorder now lives in `useTerminalPaneDrag`; the
  stack retains terminal selection/hydration while the hook owns pointer
  cancellation, swap commit, and cleanup.
- Terminal pane rendering now reads `getTerminalPaneRenderState`, a
  direct-tested Composite/State projection for normal and maximized tabs;
  `TerminalStack` retains renderer/hydration coordination.
- Terminal Cmd/Ctrl editing and copy chord policy now lives in the
  direct-tested `terminalInputShortcuts` model; `rendererInput` retains the
  xterm, clipboard, IME, and PTY adapters.
- Terminal renderer slot lifecycle, resize pausing/repaint, selection copy,
  OSC filtering, prompt observation, and line-boundary key routing now have
  direct behavior tests;
  `rendererPool.source.test.ts` retains only renderer ownership and platform
  boundary contracts not represented by those interactions.
- An active Agent Chat attempts only a background resident attach. A new
  provider runtime is admitted only with the first prompt, while the
  direct-tested startup seam coalesces warm attach/cold start requests for a
  chat identity.
- Agent Chat's event sink now guards replay delivery by attachment generation,
  preventing overlapping attaches from blocking or cross-delivering an old
  snapshot. Remote shell lifecycle tests assert marker-command output rather
  than shell-specific prompt escape bytes.
- Remote bootstrap URL parsing and secret scrubbing now live in the
  direct-tested `remoteBootstrapUrl` model; the password screen retains browser
  history and form ownership.
- Remote folder filtering and empty-state policy now live in the direct-tested
  `remoteFolderPickerModel`; the picker retains cache, fetch/cancellation,
  navigation, and selection ownership.
- Architecture Canvas surface placement state and terminal focus navigation now
  live in direct-tested `canvasPlacementStateModel` and `canvasTerminalFocusModel`;
  `ArchitectureCanvas` retains coordinator/facade ownership.
- Terminal CLI agent command parsing and banner pattern matching now live in
  direct-tested `cliAgentDetectionModel`, and IME whitespace normalization and
  composition commit evaluation live in direct-tested `imeCompositionModel`;
  `cliAgents.ts` and `macImeBridge.ts` retain integration facades.
- Workspace setup step reducer and agent quota/assignment capacity calculation
  now live in direct-tested `workspaceCreationReducer` and
  `workspaceAgentAssignmentModel`; `WorkspaceSetupView` and
  `useWorkspaceSetupAgentCapacity` retain UI and preference coordination.

## Ranked hotspots

| Priority | File | Approx. LOC | Why it matters | Recommended action |
|---:|---|---:|---|---|
| 1 | `src/app/App.tsx` | 1,299 | Application-level workspace, tab, pane, surface, and action orchestration remains concentrated in the composition root. | Extract only a deep seam while keeping ownership in `App.tsx`. |
| 2 | `src/modules/architecture/ArchitectureCanvas.tsx` | 731 | Camera, drawing tools and remaining interaction orchestration stay in the root; renderers, model transitions, catalog, persistence, diagram state, node lifecycle, node creation, live-surface layer, placement-anchor, cwd inheritance, surface-node factory, delete/undo shortcuts, frame-attached drag policy, dock-target projection, text editing, terminal-drop commit, canvas pointer-down, pointer-move, pointer-end, drag-move, node pointer-down, edge pointer-down, terminal-group header pointer-down, docked-surface factory, placement-actions, interaction-overlay, dock-divider, terminal-layer action, browser-layer action, terminal-size migration, terminal view-model and diagram-history seams are extracted. | Extract only remaining orchestration with a small interface. |
| 3 | `src/modules/workspaces/WorkspacesPanel.tsx` | 207 | Workspace list, setup controls, import-session UI and dialogs remain in the panel; terminal-list, workspace-row, header, list, drag and overlay seams are extracted. | Split the remaining setup-agent/import sections; keep workspace ownership in the controller. |
| 4 | `src/modules/tabs/lib/useTabs.ts` | 145 | Central tab/pane state machine and source of truth. | Do not split ownership first. Extract only pure transitions/selectors with regression tests. |
| 5 | `src-tauri/src/modules/agent_chat/mod.rs` | 95 | The agent-chat facade now exposes the runtime/command compatibility surface; provider launch, session lifecycle, daemon indexing and event replay are in focused seams. | Keep the facade thin; deepen runtime lifecycle or command adapters only where a concrete policy seam exists. |
| 6 | `src-tauri/src/modules/db.rs` | 1,098 → 117 | Schema, migration, workspace/pane, recent/mobile, agent persistence, and tests now live behind a compatibility facade. | Keep stable; change only with migration/query contract tests. |
| 7 | `src/modules/ai/components/AgentChatWorkspace.tsx` | 295 | Timeline presentation, model/control discovery, voice, composer, session wiring and edit summary are mixed. | Extract model controls, edit-summary card, and timeline message rendering; keep session lifecycle in its hook. |
| 8 | `src/modules/source-control/SourceControlPanel.tsx` | 225 | Rendering and source-control interaction coordination are now split into model, header, row, change-list, composer, and remote-action seams. | Further split only if a new seam hides meaningful behavior; preserve `useSourceControlPanel` interface. |
| 9 | `src/modules/terminal/lib/useTerminalSession.ts` | 183 | React hook facade for the terminal session; imperative PTY/runtime registry, output routing, renderer binding, respawn and disposal now live in a dedicated runtime module. | Refactor only with lifecycle regression tests and manual PTY verification. |

### Intentionally lower priority

- `src/modules/explorer/lib/fileIcons.ts` (~2,681 LOC): mostly a static icon
  catalog/generated mapping. Do not refactor manually unless the generation
  source or loading strategy changes.
- `src/modules/architecture/terminalDockLayout.ts` (~607 LOC): persisted dock
  normalization now lives in `terminalDockNormalization.ts`; geometry and tree
  mutation policy remain behind the compatible layout facade.
- Large test files such as `terminalDockLayout.test.ts`: reduce duplication only
  when it improves test intent, not as a production refactor target.

## Recommended execution order

### Phase 1 — Agent chat daemon completion

**Goal:** make agent runtime lifecycle independent from React tab mounting.

Target files:

- `src-tauri/src/modules/agent_chat/mod.rs`
- `src-tauri/src/modules/agent_chat/adapter.rs`
- `src-tauri/src/modules/agent_chat/events.rs`
- `src/modules/ai/hooks/useAgentChatSession.ts`
- `src/modules/ai/lib/agentChatRuntime.ts`

Seams:

1. `AgentDaemon`: durable `chatId` → one provider runtime.
2. `AgentEventSink`: attach/detach, bounded replay, stale-channel cleanup
   (implemented in `src-tauri/src/modules/agent_chat/event_sink.rs`).
3. Provider session adapters: launch/send/cancel/close/history.
4. Tauri command adapters: preserve `agent_chat_*` wire names and payloads.

Phase 1 progress: Claude and print provider turn spawning is isolated in
`src-tauri/src/modules/agent_chat/claude_turn.rs` and
`src-tauri/src/modules/agent_chat/print_turn.rs`, while provider-specific start
construction is isolated in
`src-tauri/src/modules/agent_chat/launch.rs`. Public Tauri command adapters are
isolated in `src-tauri/src/modules/agent_chat/commands.rs`; the remaining
cleanup is to tighten the coordinator interface and add stronger lifecycle
integration tests. The runtime coordinator and shared process/session lifecycle
helpers now live in `src-tauri/src/modules/agent_chat/runtime.rs`, leaving
`mod.rs` as the compatibility facade. Native transcript discovery and
provider-specific history normalization now live in
`src-tauri/src/modules/agent_chat/history.rs`; `commands.rs` retains the
annotated Tauri wrapper and workspace authorization gate. Close now routes
through the same `stop_session` helper used by idle reaping, so backend kill
and wait policy has one implementation. Model and slash-option discovery
commands now live in `model_commands.rs`, while `commands.rs` re-exports their
generated Tauri command symbols so registration remains unchanged. Session
lifecycle commands now follow the same adapter seam in `session_commands.rs`;
`commands.rs` is reduced to the history wrapper and command re-exports. Shared
JSON writing, send, cancel and stop policies now live in `lifecycle.rs`, so
process ownership and cleanup have one implementation. Provider startup is
split into `launch_protocol.rs` for Codex/OMP and `launch_print.rs` for
Claude/Print; `launch.rs` remains a two-line compatibility facade.
The `sessions.rs` compatibility facade now contains only the shared exit-error
policy and re-exports. Protocol startup is now split into
`codex_launch.rs` and `omp_launch.rs`; `launch_protocol.rs` remains a
two-line compatibility facade. Claude/Print turn runners remain isolated in
their respective modules, and all provider-family launch seams preserve the
existing event reader and cancellation behavior. Provider event normalization
now lives in `event_parsers.rs`; `adapter.rs` retains only launch metadata,
JSON decoding and the compatibility parser entry point.

Proof:

- Same `chatId` never spawns two providers.
- Attach receives replay before live events.
- Detach does not kill the process.
- Explicit close kills it and removes the mapping.
- Idle reaper bounds resident processes.
- Warm attach and cold start latency are logged and measurable.

OS daemon/sidecar packaging is a separate decision. Do not start it before a
real cold-start benchmark shows the in-process resident runtime is insufficient.

### Phase 2 — Remote module decomposition

**Goal:** reduce the highest-risk Rust module without changing remote behavior.

Suggested structure:

```text
src-tauri/src/modules/remote/
  state.rs          # RemoteAccessState and server lifecycle
  server.rs         # listener, shutdown and accept loop
  http.rs           # HTTP routes and static UI assets
  websocket.rs      # handshake, frames and command dispatch
  sessions.rs       # remote PTY/session state and output replay
  devices.rs        # device-scoped access integration
  tests.rs           # source/contract tests as appropriate
```

Keep `remote.rs` as a thin module facade if existing imports make a directory
migration risky. Move one domain at a time and run remote tests after each move.

### Phase 3 — Architecture canvas decomposition

Suggested seams:

- `useCanvasCamera`: pan, zoom and viewport transforms.
- `useCanvasDrawing`: rectangle/circle/line/arrow/pen/text/image modes.
- `useCanvasNodeInteractions`: select, drag, resize, rotate, connect.
- `useCanvasTerminalInteractions`: terminal create/resize/focus lifecycle.
- `CanvasNodeRenderer`: node-kind dispatch and rendering.
- Existing `terminalDockLayout.ts` remains the layout implementation, not a
  second source of camera state.

Invariants:

- Camera transforms never trigger PTY fit/resize on every camera tick.
- Canvas terminal state stores layout metadata, not live sessions.
- Resizing batches UI updates and fits terminals only after settling.
- Active/inactive surfaces preserve current visibility behavior.

### Phase 4 — Workspaces panel decomposition

Suggested modules:

- `WorkspaceRow.tsx`
- `WorkspaceTerminalRow.tsx`
- `WorkspaceSetupSection.tsx`
- `WorkspaceImportSession.tsx`
- `useWorkspacePanelView.ts`

The panel must remain a presentation surface. Workspace hydration, persistence,
selection and terminal ownership stay in
`src/app/lib/useWorkspaceController.ts` and
`src/app/lib/useWorkspaceSelectionController.ts`.

### Phase 5 — Database query decomposition

Suggested modules after migration tests are stable:

- `db/schema.rs`
- `db/migrations.rs`
- `db/workspaces.rs`
- `db/panes.rs`
- `db/agent_chat.rs`
- `db/recent.rs`

### Agent chat decomposition progress

- [x] Extract `AgentEditCard.tsx` for the edited-file summary, review and undo
  actions while keeping edit lifecycle in `AgentChatWorkspace.tsx`.
- [x] Extract `AgentReasoningItem.tsx` and `AgentToolTimelineItem.tsx` for
  reasoning/tool timeline leaf rendering.
- [x] Extract `AgentAssistantMessage.tsx` for markdown response rendering and
  copy/fork/work-duration actions.
- [x] Extract `AgentUserPrompt.tsx` for prompt editing, copy actions and chat
  history attachment rendering.
- [x] Extract `AgentChatOutlineRail.tsx` for prompt navigation hover/focus
  behavior and outline rendering.
- [x] Extract `AgentAttachmentPicker.tsx` for image/file/issue-PR/URL
  attachment entry points and file-input interaction state.
- [x] Extract `AgentModelPicker.tsx` for model search, loading/error display,
  selection and refresh behavior.
- [x] Extract `AgentSlashOptionPicker.tsx` for effort/mode option popovers,
  loading/empty states and selection behavior.
- [x] Extract `AgentComposerAttachments.tsx` for removable file and chat-history
  attachment chips with object-URL cleanup.
- [x] Extract `AgentVoiceControls.tsx` for voice recording/transcription UI and
  start/cancel/confirm interactions.
- [x] Extract `AgentContextWindowMeter.tsx` for context-token percentage,
  warning colors and usage tooltip rendering.
- [x] Extract `useAgentChatScroll.ts` for near-bottom tracking, active outline
  synchronization and timeline auto-scroll behavior.
- [x] Extract `useAgentUsagePolling.ts` for supported-provider usage polling,
  interval cleanup and stale-request guards.
- [x] Extract `useAgentAttachments.ts` for bounded file parsing, URL
  attachments and preview URL lifecycle cleanup.
- [x] Extract `useAgentChatControls.ts` for model/cache/config loading,
  slash-option discovery and chat-control persistence.
- [x] Extract `useAgentEditSummary.ts` for post-turn git snapshots, diff
  counting and untracked-file fallback handling.
- [x] Extract `AgentTimeline.tsx` for empty-state, message-kind dispatch,
  response status/error and usage presentation.
- [x] Extract `AgentComposerActionBar.tsx` for picker controls, voice state,
  fast/plan toggles and send/steer/cancel actions.
- [x] Extract `useAgentEditActions.ts` for review dispatch and same-repository
  discard behavior.

### Source-control decomposition progress

- [x] Extract `SourceControlEntryRow.tsx` for file selection, stage/unstage,
  discard, status accents and path/icon presentation.
- [x] Extract `SourceControlRemoteActions.tsx` for fetch, pull and refresh
  controls with busy-state labels and upstream/diverged guards.
- [x] Extract `SourceControlCommitComposer.tsx` for commit-message editing,
  keyboard shortcut, staged status, commit/push actions and feedback timeout.
- [x] Extract `SourceControlDiscardDialog.tsx` for pending single/all discard
  confirmation and cancellation behavior.
- [x] Extract `SourceControlChangeList.tsx` for virtualized changed-file rows,
  listbox keyboard navigation and stage/discard interactions.

### Terminal decomposition progress

- [x] Extract `useTerminalRendererPreferences.ts` for renderer pool preference
  synchronization without moving PTY/session ownership.
- [x] Extract `terminalBufferModel.ts` for ANSI stripping and bounded tail
  normalization while keeping live xterm buffer access in the session hook.
- [x] Extract `terminalInputModel.ts` for guarded prompt replacement and
  Ctrl-U clearing policy while keeping PTY writes and session state in the
  session hook.
- [x] Extract `terminalInputTrackingModel.ts` for prompt buffers, interactive
  agent detection, and explicit input lifecycle events while keeping PTY and
  agent activity side effects in the session hook.
- [x] Extract `terminalOutputModel.ts` for bounded output tails, agent banner
  detection, spinner classification, and local-echo state while keeping xterm,
  timers, and activity callbacks in the session hook.

### App composition progress

- [x] Extract `workspaceItemsModel.ts` for workspace terminal view-model
  branching across standard, canvas, agent, and persisted-pane workspaces;
  keep tab/workspace ownership and close actions in `App.tsx`.
- [x] Extract `paneNavigationModel.ts` for directional pane candidate filtering
  and distance scoring; keep DOM measurement and focus side effects in
  `App.tsx`.
- [x] Extract `appContextModel.ts` for active-file and source-control context
  resolution across terminal, editor, and Git tabs without moving tab state or
  IPC ownership.
- [x] Extract `workspacePaneRecordModel.ts` for persisted pane command,
  provider, and native-session association policy without moving persistence
  side effects out of `App.tsx`.
- [x] Extract `editorPathModel.ts` for editor-tab path rename patches and
  dirty/clean deletion partitioning without moving tab disposal ownership.
- [x] Extend `workspaceItemsModel.ts` with active-terminal row construction so
  agent state and terminal labels have one shared view-model policy.
- [x] Extract `workspaceAgentSessionModel.ts` for agent-terminal admission,
  identity, immutable provider/session association and workspace-record updates;
  keep React state, tab creation and persistence in `useWorkspaceController.ts`.
- [x] Extract `useEditorExternalReload.ts` for AI-diff approval reloads and
  external file-write listener cleanup while keeping editor refs in `App.tsx`.
- [x] Extract `workspaceForkModel.ts` for immutable forked-agent tab metadata
  updates while keeping tab creation, recent-workspace, and persistence effects
  in `App.tsx`.
- [x] Extract `workspaceOwnershipModel.ts` for immutable tab ownership cleanup
  across regular, canvas, and agent workspaces.
- [x] Extract `workspaceNavigationModel.ts` for next/previous workspace
  wrap-around and missing-active-workspace fallback.
- [x] Extract `TerminalAgentUsage.tsx` from `PaneTreeView.tsx` for local usage
  polling, context badge/menu rendering, and interval cleanup.
- [x] Extract `paneResizeModel.ts` for adjacent-panel clamping and immutable
  pane-tree size commits while keeping pointer/RAF/PTTY effects in
  `PaneTreeView.tsx`.
- [x] Extract `fileExplorerRows.ts` for recursive tree flattening, pending rows,
  status rows, and selectable-entry indexes while keeping explorer actions in
  `FileExplorer.tsx`.
- [x] Extract `fileMoveModel.ts` for descendant removal, same-parent no-op
  filtering, and cycle-safe move validation before filesystem effects.
- [x] Extract `fileDropModel.ts` for explicit-target, focused-entry, and root
  destination fallback resolution across paste and drop flows.
- [x] Extract `explorerNavigationModel.ts` for keyboard navigation decisions
  across Arrow, Enter, Escape, and Delete while keeping DOM/tree effects in
  `FileExplorer.tsx`.
- [x] Extract `gitHistoryPresentation.tsx` for Git history path, author, time,
  status, and highlight presentation helpers while keeping data loading and
  virtualization in `GitHistoryPane.tsx`.
- [x] Extract `GitCommitFiles.tsx` for commit-file loading/error/empty states
  and review rows while keeping file fetching/cache ownership in
  `GitHistoryPane.tsx`.
- [x] Extract `GitCommitDetail.tsx` for commit metadata, copy/remote actions,
  and detail composition while keeping commit selection and file cache in
  `GitHistoryPane.tsx`.
- [x] Extract `GitCommitRow.tsx` for graph-backed commit row presentation while
  keeping filtering, virtualization, and selection state in `GitHistoryPane.tsx`.
- [x] Extract `gitHistoryModel.ts` for commit search filtering and duplicate-safe
  pagination merges while keeping async Git loading in `GitHistoryPane.tsx`.
- [x] Extract `useGitHistoryFiles.ts` for commit-file cache, in-flight dedupe,
  retry state, and bounded eviction while keeping commit pagination in
  `GitHistoryPane.tsx`.
- [x] Extract `useGitHistoryData.ts` for guarded commit loading, pagination,
  refresh state, and remote URL hydration while keeping file cache separate.
- [x] Reuse `gitHistoryModel.mergeGitCommits` inside the Git history data hook
  so pagination deduplication has a single implementation.
- [x] Reuse `terminalOutputModel.ts` in `CanvasTerminalNode.tsx` for pure agent
  output-tail/banner/local-echo classification while keeping canvas PTY
  lifecycle independent from standard terminal sessions.
- [x] Extract `canvasTerminalShortcuts.ts` for platform-aware copy/paste and
  line-deletion key mapping while keeping clipboard/PTTY effects in the canvas
  terminal component.
- [x] Extract `canvasTerminalSelectionCopy.ts` for debounced copy-on-select,
  duplicate-selection suppression, and timer cleanup while keeping clipboard
  and terminal ownership in `CanvasTerminalNode.tsx`.
- [x] Reuse `terminalBufferModel.ts` for canvas terminal buffer snapshots so
  trailing-line normalization is shared with standard terminal sessions.
- [x] Extract `rendererSlotModel.ts` for free/create/evict slot selection and
  alt-screen/focus/LRU scoring while keeping renderer and PTY resource effects
  in `rendererPool.ts`.
- [x] Extract `CanvasTerminalHeader.tsx` for canvas terminal tabs, agent
  switching, and terminal-group controls while keeping PTY lifecycle and
  viewport ownership in `CanvasTerminalNode.tsx`.
- [x] Extract `CanvasViewport.tsx` for SVG, terminal/browser layers, background,
  and interaction-overlay composition while keeping canvas state and handlers
  in `ArchitectureCanvas.tsx`.
- [x] Extract `AgentChatHistory.tsx` for outline scrolling, timeline rendering,
  latest-message navigation, and the agent edit review card while keeping chat
  session, composer, and submit ownership in `AgentChatWorkspace.tsx`.
- [x] Extract `AgentChatComposer.tsx` for textarea, attachment, and action-bar
  composition while keeping draft, voice, and submit state in
  `AgentChatWorkspace.tsx`.
- [x] Extract `AppSidebar.tsx` for browser, explorer, source-control, and
  sidebar-rail composition while keeping view state and persistence in
  `App.tsx`.
- [x] Extract `useTrayProviderUsage.ts` for enabled-provider discovery,
  concurrent usage requests, stale-request guards, and derived tray usage state
  while keeping tray workspace UI in `WorkspaceSwitcher.tsx`.
- [x] Extract `useTrayWorkspaceData.ts` for tray workspace hydration, canvas
  terminal discovery, persisted-pane fallback, and loading/error state while
  keeping query and selection UI in `WorkspaceSwitcher.tsx`.
- [x] Extract `TrayWorkspaceRow.tsx` for workspace result presentation,
  expansion, and terminal-row interactions while keeping tray selection state in
  `WorkspaceSwitcher.tsx`.
- [x] Extract `FileExplorerRow.tsx` for mapping entry/rename/pending/status row
  models to row surfaces while keeping tree, selection, virtualizer, and
  drag/drop ownership in `FileExplorer.tsx`.
- [x] Extract `sourceControlRemoteActionExecution.ts` for contextual remote-action
  policy and fetch/pull/push sequencing while keeping busy/error state in
  `useSourceControl.ts`.
- [x] Extract `usePaneResizeController.ts` for pointer/keyboard pane resizing,
  cursor cleanup, and terminal resize pause/resume while keeping pane-tree
  ownership and layout persistence in `PaneTreeView.tsx`.
- [x] Extract `FloatingTerminalOverlay.tsx` for terminal agent controls,
  navigation, usage status, Git shortstat polling, and pane actions while
  keeping leaf/tree ownership in `PaneTreeView.tsx`.
- [x] Extract `rendererWebgl.ts` for WebGL attach, context-loss fallback,
  disposal, and canvas-context cleanup while keeping renderer-pool ownership
  and the public preference bridge in `rendererPool.ts`.
- [x] Extract `rendererPreferences.ts` for font, zoom, spacing, scrollback,
  theme propagation, and debounced PTY resize while keeping pool slots and
  public preference exports in `rendererPool.ts`.
- [x] Extract `rendererInput.ts` for IME-aware keyboard policy, terminal data
  forwarding, OSC filtering, copy-on-select, and clipboard badge behavior
  while keeping slot creation and renderer ownership in `rendererPool.ts`.
- [x] Extract `rendererSerialization.ts` for bounded snapshot serialization
  and terminal dimension/alt-screen metadata while keeping release/detach
  ownership in `rendererPool.ts`.
- [x] Extract `rendererResize.ts` for fit, ResizeObserver debounce, PTY resize,
  host refresh, and pause/resume coordination while keeping slot allocation
  and binding orchestration in `rendererPool.ts`.
- [x] Extract `rendererSlotLifecycle.ts` for slot bind, rewire, detach, ring
  replay, OSC cleanup, and deferred unhide while keeping allocation/eviction
  decisions in `rendererPool.ts`.
- [x] Extract `useAppRuntimeBootstrap.ts` for home authorization, launch-CWD
  hydration, provider-key reload listeners, preferences initialization, and
  remote-access auto-start while keeping app state ownership in `App.tsx`.
- [x] Extract `useWorkspacePaneSessionSync.ts` for native-session discovery,
  cross-workspace claim deduplication, pane persistence, and delayed retry
  scheduling while keeping workspace state ownership in `App.tsx`.
- [x] Extract `WorkspaceDeleteDialog.tsx` for controlled workspace-delete
  confirmation UI and “do not ask again” input while keeping delete policy and
  workspace removal orchestration in `App.tsx`.
- [x] Extract `UnsavedChangesDialogs.tsx` for controlled tab-close and
  deleted-file confirmation surfaces while keeping disposal and pending-state
  ownership in `App.tsx`.
- [x] Extract `appShortcutCoordination.ts` for global shortcut-to-action
  mapping and context disable policy while keeping action ownership in
  `App.tsx` and feature controllers.
- [x] Extract `useLiveTerminalCleanup.ts` for pane-tree-driven PTY disposal
  and stale terminal/search-ref cleanup while keeping the live-leaf ref
  available to workspace switching in `App.tsx`.
- [x] Extract `useAppWindowEvents.ts` for registration and cleanup of the
  app-level new-tab, shortcuts, and maximize-pane Tauri events while keeping
  event actions owned by `App.tsx`.
- [x] Extract `useWorkspaceForkActions.ts` for forked-agent routing to a new
  chat tab or workspace setup while keeping workspace/tab persistence adapters
  owned by `App.tsx`.
- [x] Extract `useWorkspaceEnvironmentSwitch.ts` for dirty-editor guards,
  local/WSL home resolution, authorization, runtime-ref cleanup, and workspace
  reset while keeping environment and tab state ownership in `App.tsx`.
- [x] Extract `useSplitPanePersistence.ts` for workspace pane-tree metadata
  and per-pane persistence after splits while keeping split decisions and
  tab ownership in `App.tsx`.
- [x] Extract `useDirectionalPaneFocus.ts` for DOM-based directional pane
  candidate filtering and focus selection while keeping active-tab state and
  focus ownership in `App.tsx`.
- [x] Extract `useAppFileActions.ts` for explorer file opening, editor-path
  rename propagation, and dirty/clean deletion classification while keeping
  tab disposal and confirmation state in `App.tsx`.
- [x] Extract `useBottomTerminalController.ts` for drawer CWD fallback
  resolution, open/toggle behavior, and post-open focus while keeping drawer
  state ownership in `App.tsx`.
- [x] Extract `useAppTabNavigation.ts` for tab cycling, regular/private tab
  creation, and delayed `cd`/focus behavior while keeping tab ownership in
  `useTabs` and `App.tsx`.
- [x] Extract `useAppHandleRegistry.ts` for terminal, editor, and preview
  handle registration/removal plus active-editor synchronization while keeping
  refs and feature ownership in `App.tsx`.
- [x] Keep active-editor lookup inside `useAppHandleRegistry.ts` so handle
  registration and active-tab synchronization share one lifecycle seam.
- [x] Extract `useCanvasTerminalHandleRegistry.ts` for keyed Canvas terminal
  handle registration and active-terminal selection signaling while keeping
  Canvas/tab ownership in `App.tsx`.
- [x] Extract `useCanvasTerminalCreatorRegistration.ts` for capped terminal
  creator registration, pending-command capture, and cleanup while keeping
  placement ownership in `ArchitectureCanvas.tsx`.
- [x] Extract `useAppSearchTarget.ts` for terminal, editor, and Git History
  search-target selection plus focus routing while keeping refs and tab state
  ownership in `App.tsx`.
- [x] Extract `useAppSearchRegistry.ts` for active-leaf search-addon lookup
  and terminal search registration while keeping search state ownership in
  `App.tsx`.
- [x] Extract `useAppChromeActions.ts` for sidebar/workspaces toggles, canvas
  focus, sidebar-view cycling, explorer focus restoration, and resize pausing
  while keeping shell state ownership in `App.tsx`.
- [x] Extract `useBootstrapTabCleanup.ts` for temporary-shell cleanup after
  workspace activation while keeping bootstrap refs and tab ownership in
  `App.tsx`.
- [x] Extract `useWorkspaceDeletion.ts` for last-workspace guards, owned-tab
  collection, final-shell detection, and controller delegation while keeping
  confirmation state/UI in `App.tsx`.
- [x] Extract `useWorkspaceDeleteConfirmation.ts` for skip-confirm preference
  persistence and pending workspace-delete transitions while keeping actual
  deletion in `useWorkspaceDeletion.ts`.
- [x] Extract `usePreviewTabAction.ts` for preview-tab creation and delayed
  address-bar focus while keeping tab ownership in `useTabs`/`App.tsx`.
- [x] Extract `useAppAgentSessionIdentity.ts` for live tab/workspace native
  session identity updates and SQLite persistence while keeping provider/tab
  ownership in `App.tsx`.
- [x] Extract `useWorkspaceSetupActions.ts` for workspace creation payload
  assembly and empty-workspace cancel guarding while keeping creation adapters
  and state ownership in `App.tsx`/`useWorkspaceController`.
- [x] Extract `useWorkspaceSessionImportAction.ts` for agent-session import
  port assembly and alert fallback while keeping import implementation and
  workspace/tab ownership in `useWorkspaceController`/`App.tsx`.
- [x] Extract `useWorkspaceSetupAutoOpen.ts` for opening setup after hydrated
  empty-workspace state while keeping setup state ownership in `App.tsx`.
- [x] Extract `useWorkspaceTerminalCreationAction.ts` for standard/canvas/
  agent terminal creation port assembly while keeping mode-specific behavior
  in `useWorkspaceController`.
- [x] Extract `useAppTabClose.ts` for dirty-editor close guarding and explicit
  confirm/cancel actions while keeping tab disposal and dialog state in
  `App.tsx`.
- [x] Extract `useMusicTabAction.ts` for Music CLI installation and terminal
  tab creation while keeping tab creation and inherited-CWD adapters in
  `App.tsx`.
- [x] Extract `useAppSourceControlActions.ts` for source-control panel
  navigation and Git Graph repo resolution while keeping source-control state
  and tab creation ownership in `App.tsx`.
- [x] Keep renderer slot binding, release, serialization, and resize-observer
  lifecycle isolated in `rendererPool.ts` after extracting input, WebGL, and
  preference policies into focused modules.
- [x] Extract `useAppActiveContext.ts` for active tab/workspace ownership
  resolution and surface-kind predicates while keeping state ownership in
  `App.tsx`.
- [x] Extract `useAppSourceControlContext.ts` for Git context path resolution,
  activation policy, and badge-path fallback while keeping source-control
  state and actions owned by `App.tsx`.
- [x] Extract `useAppPaneActions.ts` for split persistence, close
  pane-vs-tab routing, and maximize behavior while keeping tab ownership in
  `useTabs` and `App.tsx`.
- [x] Move active coding-agent counting into the tested pure
  `workspaceItemsModel.ts` policy module, keeping workspace/tab state ownership
  in `App.tsx`.
- [x] Extract `useAppWorkspaceTerminalView.ts` for live terminal-row and
  coding-agent-count derivation while keeping terminal/workspace ownership in
  `App.tsx`.
- [x] Extract `useAppWorkspaceItems.ts` for memoized workspace-item
  composition and close-action routing while keeping refs and state ownership
  in `App.tsx`.
- [x] Centralize active terminal leaf cwd resolution in `appContextModel.ts`,
  preserving leaf-cwd/tab-cwd fallback semantics with direct behavior coverage.
- [x] Remove the duplicate workspace accent-index policy from
  `useWorkspaceController.ts` and reuse `workspaceCreationModel.ts` as the
  single source of truth.
- [x] Extract unique workspace naming and display-order reorder policy into
  `workspaceRecordModel.ts`, preserving controller state/IPC ownership with
  direct behavior coverage.
- [x] Expand workspace record behavior coverage for before/after placement,
  invalid targets, no-op moves, and input immutability.
- [x] Centralize recent-workspace projection in `workspaceRecordModel.ts`,
  preserving folder filtering and serialized record shape with direct coverage.
- [x] Centralize workspace record updates derived from pane trees in
  `workspaceRecordModel.ts`, preserving count/layout serialization and input
  immutability with direct coverage.
- [x] Extract workspace/recent/pane hydration I/O lifecycle into
  `useWorkspaceHydration.ts` with an injectable invoke adapter, keeping
  controller state ownership unchanged.
- [x] Extract persisted workspace record normalization into the hydration
  seam and add direct coverage for mode, accent, and transient ownership
  defaults.
- [x] Extract setup imported-session capacity and custom-agent cleanup guards
  into `useWorkspaceSetupStateGuards.ts`, keeping setup state ownership in
  `WorkspaceSetupView.tsx`.
- [x] Extract setup back/primary action navigation and launch gating into
  `useWorkspaceSetupNavigation.ts`, keeping setup state ownership in
  `WorkspaceSetupView.tsx`.
- [x] Remove the duplicate canvas workspace diagram builder from
  `useWorkspaceController.ts`, reusing `workspaceCreationModel.ts` as the
  single layout policy.
- [x] Remove the duplicate workspace accent-index policy from
  `useWorkspaceHydration.ts`, reusing `workspaceCreationModel.ts` as the
  single color-order policy.
- [x] Extract pure workspace creation-plan assembly into
  `workspaceCreationModel.ts`, keeping tab creation, IPC, and state mutation
  in `useWorkspaceController.ts`.
- [x] Extract the workspace creation use-case, including persistence and
  activation sequencing, into `workspaceCreationAction.ts`; keep controller
  state and the public controller return contract unchanged.
- [x] Extract workspace controller records and feature port contracts into
  `workspaceControllerTypes.ts`, preserving compatibility type exports from
  `useWorkspaceController.ts`.
- [x] Extract app bootstrap/loading derived state into
  `appStartupViewModel.ts`, preserving blocking/local/idle gate behavior with
  direct coverage.
- [x] Extract status, voice, editor, updater, import, and confirmation overlay
  composition into `AppOverlays.tsx`, keeping overlay state ownership in
  `App.tsx`.

Do not change table names, serialized field names, migration direction, or
workspace/tab ownership during this phase.

### Phase 6 — Tab state-machine deepening

Only after the previous phases:

- [x] Extract `tabPaneModel.ts` for pane-count clamping, saved-layout parsing
  and pane-tree construction; preserve `useTabs` ownership and public limit.
- [x] Extract `tabTransitions.ts` for pure tab reorder and index-selection
  transitions with direct unit coverage.
- [x] Extract `tabTypes.ts` for the tab domain model and preserve type
  re-exports from `useTabs` for compatibility.
- [x] Extract `tabPatchModel.ts` for pure per-variant tab patching, URL title
  derivation and preview auto-promotion.
- [x] Extract `tabFactories.ts` for terminal/private/editor/agent-chat tab
  object construction while preserving `useTabs` state ownership.
- [x] Extend `tabFactories.ts` with preview, markdown and architecture tab
  construction.
- [x] Extend `tabFactories.ts` with Git diff, history and commit-file diff tab
  construction.
- [x] Extract `gitTabTransitions.ts` for Git diff/history/commit-file dedupe,
  update and target-selection policies.
- [x] Extend `tabFactories.ts` with AI-diff tab construction while preserving
  approval defaults.
- [x] Extend `tabFactories.ts` with workspace terminal tab construction for
  hydrated pane trees.
- [x] Extend `tabFactories.ts` with exact initial/reset terminal tab
  construction, preserving legacy pane metadata shape.
- [x] Extract `editorTabTransitions.ts` for persistent/preview editor dedupe,
  promotion and preview-slot replacement.
- [x] Extend `editorTabTransitions.ts` with explicit preview promotion for
  tab-bar pin actions.
- [x] Extract `markdownTabTransitions.ts` for markdown-path dedupe and tab
  creation without consuming IDs for existing tabs.
- [x] Extract `tabCloseModel.ts` for pure tab removal, active-tab fallback and
  terminal leaf disposal selection.
- [x] Extract `tabPaneUpdates.ts` for pure cwd, command metadata and pane-focus
  transitions while preserving no-op reference behavior.
- [x] Extend `tabPaneUpdates.ts` with next/previous pane focus transitions and
  direct split-tree coverage.
- [x] Extract `tabPaneLifecycle.ts` for split/append pane limits, ID allocation,
  active-leaf updates and maximize reset behavior.
- [x] Extract `tabPaneClose.ts` for sibling fallback, active-leaf selection and
  maximize cleanup when closing panes.
- [x] Extend `tabPaneClose.ts` with terminal-pane-to-tab transition policy:
  closing a final pane closes its tab when possible, chooses the previous tab,
  and preserves the final-tab PTY-disposal behavior.
- [x] Extend `tabCloseModel.ts` with reset-workspace tab replacement and
  terminal leaf disposal collection.
- [x] Extract `aiDiffTransitions.ts` for final AI-diff approval behavior and
  active-tab fallback when closing diff tabs.
- [x] Extend `aiDiffTransitions.ts` with isolated approval-status updates and
  direct matching-approval coverage.
- [x] Extend `aiDiffTransitions.ts` with open/dedupe policy that avoids
  consuming IDs for existing approvals.
- [x] Extend `tabPaneUpdates.ts` with pure tree replacement and maximize toggle
  transitions.
- [x] Extract tab creation callbacks into `useTabCreationActions.ts`, keeping
  `useTabs` as the state/ID owner and preserving all public creation methods.
- [x] Extract editor, AI-diff, Git open/close and patch actions into
  `useTabOpenActions.ts`; keep PTY-disposing tab closure in `useTabs`.
- [x] Extract tab, pane and workspace reset cleanup into
  `useTabCloseActions.ts`, preserving active-tab fallback and explicit
  `disposeSession` calls.
- [x] Extract pane metadata, focus, split/append, tree replacement and
  maximize actions into `useTabPaneActions.ts`, keeping pane state owned by
  `useTabs` and reusing existing pane transition models.

- Extract pure tab transitions (`open`, `close`, `reorder`, `activate`, `split`).
- Extract selectors for active surface and workspace ownership.
- Keep `useTabs` as the owner and preserve its public interface.
- Add transition tests before moving implementation code.

## Quality gates

Run sequentially after each coherent phase:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
git diff --check
```

Additional gates by phase:

- Remote: targeted remote/device/relay/tunnel tests.
- Canvas: camera, docking, terminal lifecycle and render tests.
- Workspaces: workspace selection, persistence and import-session tests.
- Database: SQLite migration and round-trip tests.
- Agent chat: provider protocol, attach/replay/reaper tests.

## Refactor rules

- Write a regression test before moving behavior when no existing test protects
  the seam.
- Prefer deletion/reuse over new abstraction layers.
- A new module must hide meaningful lifecycle or policy, not merely forward
  props or arguments.
- Preserve Tauri command names and frontend payloads unless a migration contract
  is explicitly added.
- Keep resource ownership explicit: PTY/provider processes must have one owner,
  one close path and a tested cleanup path.
- Do not use LOC reduction as the success metric. Measure interface depth,
  coupling, testability and behavior preservation.

## Known risks

- Splitting `remote.rs` can create circular dependencies between auth, sessions
  and protocol code. Use private ports or a facade instead of cross-importing
  implementation details.
- Canvas extraction can remount terminal nodes and accidentally respawn/resize
  PTYs. Verify React keys and lifecycle ownership before moving JSX.
- Workspace panel extraction can reintroduce state duplication into feature UI.
- Agent daemon residency can increase RAM if idle reaping or stale-channel
  cleanup regresses.
- Database decomposition can hide migration ordering bugs. Keep migrations
  additive and test against old schema fixtures.

## Current recommendation

Phase 2 is complete for the remote transport/session/server lifecycle scope.
Phase 3 is in progress for the architecture canvas, and the workspace backend
decomposition has started with a verified authorization/platform seam. Do not
refactor `useTabs.ts` or the generated icon catalogs first.

## Phase 2 progress

- [x] Extract remote PTY/session state and output replay types into
  `src-tauri/src/modules/remote/sessions.rs`.
- [x] Extract remote HTTP request parsing, asset serving, response formatting
  and remote UI state helpers into `src-tauri/src/modules/remote/http.rs`.
- [x] Extract browser/native WebSocket connection loops and handshake lifecycle
  into `src-tauri/src/modules/remote/websocket.rs`.
- [x] Extract native-device command dispatch and capability routing into
  `src-tauri/src/modules/remote/device_commands.rs`.
- [x] Preserve `modules::remote::*` imports and remote protocol behavior through
  the `remote.rs` facade.
- [x] Extract remote runtime/PTy/session operations into
  `src-tauri/src/modules/remote/runtime.rs`.
- [x] Run remote-focused tests and Clippy after the extraction.
- [x] Extract remote server state, shutdown/status ownership into
  `src-tauri/src/modules/remote/state.rs`.
- [x] Extract the listener accept loop into
  `src-tauri/src/modules/remote/server.rs`.
- [x] Extract the paired-device WebSocket handshake and connection loop into
  `src-tauri/src/modules/remote/device_websocket.rs`, keeping the desktop
  WebSocket facade and device capability dispatch separate.
- [x] Extract remote folder listing, SSE streaming and PTY snapshot response
  formatting into `src-tauri/src/modules/remote/runtime_http.rs`, preserving
  `runtime.rs` compatibility re-exports for server and WebSocket callers.
- [x] Extract canonicalization, CWD authorization and desktop/mobile workspace
  resolution into `src-tauri/src/modules/remote/runtime_cwd.rs`, keeping one
  security seam for all remote session creation paths.
- [x] Extract remote session and desktop/mobile workspace creation policy into
  `src-tauri/src/modules/remote/runtime_creation.rs`, keeping low-level PTY
  construction owned by `runtime.rs` and preserving facade re-exports.
- [x] Extract low-level remote PTY spawning and platform shell command setup
  into `src-tauri/src/modules/remote/runtime_pty.rs`, leaving `runtime.rs` as
  the session-operation facade and preserving its public internal helpers.
- [x] Centralize paired-device view/create/session capability checks in
  `src-tauri/src/modules/remote/device_authorization.rs`, keeping command
  execution and protocol responses in `device_commands.rs`.
- [x] Extract paired-device directory listing, folder picker, file preview and
  directory creation into `src-tauri/src/modules/remote/device_filesystem.rs`,
  preserving capability and workspace-root authorization at the caller seam.
- [x] Extract browser/paired-device importable-session listing, resume command
  construction and import execution into
  `src-tauri/src/modules/remote/device_session_import.rs`, preserving device
  ownership and active-session guards.
- [x] Extract paired-device attachment state, output replay/drain, controller
  release and device WebSocket envelope helpers into
  `src-tauri/src/modules/remote/device_attachment.rs`, keeping command routing
  and capability policy in `device_commands.rs`.
- [x] Extract paired-device session listing and workspace response projection
  into `src-tauri/src/modules/remote/device_views.rs`, reusing the centralized
  viewer capability policy and preserving response payloads.
- [x] Extract paired-device terminal attach/detach, input, resize and close
  policy into `src-tauri/src/modules/remote/device_terminal_control.rs`,
  preserving controller ownership and capability checks in one seam.
- [x] Extract remote Tauri command implementations into
  `src-tauri/src/modules/remote_commands.rs`, preserving the command names,
  generated `__cmd__` symbols, and `modules::remote::*` registration surface.
- [x] Run TypeScript, frontend tests (680), relay tests (6), frontend build,
  Rust check, Clippy, targeted remote tests (67) and diff checks.
- [x] Resolve the WebSocket test's protocol sequencing assumption and verify
  the complete Rust suite: 236 passed.

The WebSocket integration test now consumes the protocol's provider snapshot
before asserting the session list, so the complete Rust suite remains stable.

## Workspace backend progress

- [x] Extract workspace registry, CWD authorization, bootstrap policy and
  workspace authorization commands into
  `src-tauri/src/modules/workspace_auth.rs`, preserving the
  `modules::workspace::*` facade and Tauri command symbols.
- [x] Extract the WSL path, distro discovery and shell adapter into
  `src-tauri/src/modules/workspace_wsl.rs`, preserving non-Windows behavior and
  the existing public re-exports.
- [x] Extract launch-CWD snapshot, fallback and executable-directory filtering
  into `src-tauri/src/modules/workspace_launch.rs`, preserving the public
  `init_launch_cwd` and `launch_cwd_snapshot` facade exports.
- [x] Verify workspace-focused tests (20) and the full Rust suite (238 passed,
  2 ignored), plus `cargo check` and Clippy.
- [ ] Review the remaining `WorkspaceEnv` and `resolve_path` composition for a
  genuinely deep seam; keep `workspace.rs` as the compatibility facade and do
  not split stable pure helpers without a contract benefit.

## Git backend progress

- [x] Extract Git log, commit diff, commit-file projection and commit-file diff
  operations into `src-tauri/src/modules/git/history.rs`, keeping parsing and
  SHA validation local to the read-only history seam.
- [x] Preserve `git::operations::*` re-exports so existing Tauri command
  adapters and payloads remain unchanged.
- [x] Extract Git stage, unstage, discard, commit, push, fetch and fast-forward
  pull policy into `src-tauri/src/modules/git/mutations.rs`, keeping shared
  pathspec construction at the operations composition seam.
- [x] Extract Git repository resolution, panel snapshot, status, diff,
  diff-content and remote URL queries into `src-tauri/src/modules/git/queries.rs`,
  keeping pathspec construction in the shared query seam.
- [x] Extract absolute-to-Git pathspec projection and batch pathspec resolution
  into `src-tauri/src/modules/git/query_pathspec.rs`, preserving the
  `operations::*` compatibility exports used by mutation commands.
- [x] Extract Git command construction (including WSL), bounded child
  execution, timeout/kill handling and output draining into
  `src-tauri/src/modules/git/process_runner.rs`, preserving `run_git` and
  `build_git_command` compatibility exports.
- [x] Extract Git output projection, safe text-file reading, binary/UTF-8
  decoding and command error classification into
  `src-tauri/src/modules/git/process_output.rs`, preserving process exports.
- [x] Extract Git history shortstat, SHA validation, NUL name-status/numstat
  parsing and status-label projection into
  `src-tauri/src/modules/git/history_parser.rs`, keeping command orchestration
  and repository authorization in `history.rs`.
- [x] Verify focused Git tests (19), full Rust tests (251 passed, 2 ignored),
  `cargo check --all-targets --locked`, Clippy and diff hygiene.
- [x] Extract Git availability cache, workspace-key policy, version probing and
  minimum-version checks into `src-tauri/src/modules/git/process_availability.rs`,
  preserving `ensure_git_available` and the WSL/local cache semantics.
- [x] Keep `process.rs` as a 13-line compatibility facade for runner, output and
  availability seams; no Git command or payload contract changed.
- [ ] Keep the 276-line Git query facade focused on authorized command
  orchestration; only split another seam when it hides meaningful policy.

## Agent usage progress

- [x] Extract Command Code authentication, billing/usage requests, plan mapping
  and quota serialization into
  `src-tauri/src/modules/agent_command_code_usage.rs`, keeping scanner and
  command facades compatible.
- [x] Preserve the existing Command Code provider payload and fallback behavior.
- [x] Extract bounded JSONL discovery, transcript tail reading, cwd matching and
  path normalization into `src-tauri/src/modules/agent_usage_files.rs`, keeping
  provider parsing and selection in `agent_usage_scan.rs`.
- [x] Extract Codex/Claude usage parsing, rate-limit projection and provider
  snapshot policy into `src-tauri/src/modules/agent_usage_parsers.rs`, keeping
  the existing `agent_usage` re-exports and payload types unchanged.
- [x] Extract the OpenCode read-only SQLite usage adapter into
  `src-tauri/src/modules/agent_usage_opencode.rs`, preserving the latest-session
  query, token/cost projection and timestamp conversion.
- [x] Extract Command Code credits, rate-limit, plan and account-usage
  projection into `src-tauri/src/modules/agent_command_code_projection.rs`,
  leaving network/auth fetching in `agent_command_code_usage.rs` and preserving
  the public snapshot export.
- [x] Verify usage-focused tests (12), full Rust tests (255 passed, 2 ignored),
  `cargo check --all-targets --locked`, Clippy and diff hygiene.
- [ ] Add more fixture coverage for provider billing responses before changing
  the adapter's external request or serialization contract; keep
  `agent_usage_scan.rs` focused on filesystem/provider selection.

## Agent chat model progress

- [x] Extract Codex app-server model, permission, effort and collaboration-mode
  discovery into `src-tauri/src/modules/agent_chat/models_codex.rs`, preserving
  the generic `list_models`/`list_slash_options` dispatch and provider payloads.
- [x] Keep Codex RPC transport and response projection behind one adapter seam;
  verify agent-chat focused tests (38), full Rust tests (240 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract generic command model/flag discovery, child-process timeout
  handling and model-line parsing into
  `src-tauri/src/modules/agent_chat/models_command.rs`, preserving generic
  dispatch and parser tests.
- [x] Verify agent-chat focused tests (38), full Rust tests (240 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract interactive slash PTY discovery and menu parsing into
  `src-tauri/src/modules/agent_chat/models_interactive.rs`, preserving timing,
  cancellation and model projection behavior.
- [x] Verify agent-chat focused tests (38), full Rust tests (240 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [ ] Audit the remaining 137-line model facade only for contract-focused test
  improvements; avoid further decomposition without a new policy seam.

## Agent event parser progress

- [x] Extract Gemini, OpenCode and CommandCode event normalization into
  `src-tauri/src/modules/agent_chat/event_parsers_external.rs`, preserving the
  shared `AgentChatEvent` wire shape and parser dispatch.
- [x] Verify agent-chat focused tests (38), full Rust tests (239 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract the Codex app-server event adapter into
  `src-tauri/src/modules/agent_chat/event_parsers_codex.rs`, preserving shared
  delta projection and event wire shape.
- [x] Verify agent-chat focused tests (38), full Rust tests (239 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract Claude JSON and OMP RPC event adapters into
  `src-tauri/src/modules/agent_chat/event_parsers_core.rs`, leaving the
  dispatcher and shared path/delta helpers in a 46-line facade.
- [x] Verify agent-chat focused tests (38), full Rust tests (239 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [ ] Keep the 46-line parser facade stable; add contract fixtures before any
  future parser changes.

## PTY backend progress

- [x] Extract PATH, login-shell PATH, user-bin discovery, executable checks and
  WSL CLI probing into `src-tauri/src/modules/pty/cli_probe.rs`, preserving the
  `pty::check_agent_clis` command and generated Tauri symbol.
- [x] Extract PTY Tauri command handlers (`open`, `write`, `resize`, `close`,
  metadata/list and agent-session listing) into
  `src-tauri/src/modules/pty_commands.rs`, preserving command symbols while
  keeping `PtyState` ownership in `pty_state.rs`.
- [x] Extract `PtyState` registry storage and remote output/write/resize methods
  into `src-tauri/src/modules/pty_state.rs`, preserving the shared state object
  used by desktop commands and remote sessions.
- [x] Extract bounded output replay, sequence assignment and disconnected
  subscriber cleanup into `src-tauri/src/modules/pty/session_output.rs`, keeping
  the Observer lifecycle local to the PTY session.
- [x] Extract PTY native spawn, reader/flusher/waiter thread orchestration into
  `src-tauri/src/modules/pty/session_spawn.rs`, preserving `session::spawn`
  and native PTY/process ownership in `Session`.
- [x] Extract importable-session root discovery, JSONL traversal, mtime sorting,
  provider aggregation and global limit handling into
  `src-tauri/src/modules/pty/session_import_scan.rs`, keeping provider parsers
  and the `list_agent_sessions` contract in `session_import.rs`.
- [x] Move CLI probe tests with the implementation and verify focused PTY tests
  (52), full Rust tests (240 passed, 2 ignored), `cargo check`, Clippy and diff
  hygiene.
- [x] Verify session-import focused tests (5), full Rust tests (240 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract native Claude, Codex and Pi session parsers plus Codex activity
  lock detection into `src-tauri/src/modules/pty/session_import_native.rs`,
  preserving shared normalization helpers and extended-provider adapters.
- [x] Extract the OpenCode SQLite session listing adapter into
  `src-tauri/src/modules/pty/session_import_opencode.rs`, preserving the
  read-only query, archive filter, ordering, limit and compatibility facade.
- [x] Extract shared session-field lookup, preview normalization and fallback
  title policy into `src-tauri/src/modules/pty/session_import_normalization.rs`,
  preserving all native and extended provider adapters.
- [x] Verify native-import focused tests (8), full Rust tests (251 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract prompt-marker initial-command bootstrap state into
  `src-tauri/src/modules/pty/session_bootstrap.rs`, and ConPTY serialization /
  child-kill cleanup policy into `session_lifecycle.rs`, preserving PTY
  ownership and close ordering.
- [x] Verify PTY-focused tests (55), full Rust tests (251 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract prompt-marker bootstrap state into
  `src-tauri/src/modules/pty/session_bootstrap.rs` and ConPTY serialization /
  child-kill cleanup into `session_lifecycle.rs`, leaving `session.rs` as the
  Session ownership/output facade and preserving close ordering.
- [x] Verify the PTY-focused suite (55), full Rust tests (251 passed,
  2 ignored), `cargo check --all-targets --locked`, Clippy and diff hygiene.
- [ ] Keep the 203-line `session_import.rs` facade focused on composition and
  provider aggregation; do not add another seam without a new policy cluster.
- [ ] Audit the 80-line `session.rs` data/lifecycle facade only if a new
  state-preserving process seam appears; do not move `PtyState` ownership away
  from `session` without lifecycle tests.

## Filesystem mutation progress

- [x] Extract trash staging, token validation, delete and restore commands into
  `src-tauri/src/modules/fs/trash.rs`, preserving the historical
  `fs::mutate::*` facade and generated Tauri command symbols.
- [x] Move trash path/token tests with the lifecycle implementation and verify
  filesystem-focused tests (14), full Rust tests (240 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract symlink-safe recursive copy, collision suffixing and clipboard
  file import into `src-tauri/src/modules/fs/import.rs`, preserving the
  `fs::mutate::*` facade and path authorization behavior.
- [x] Verify import-focused tests (5), full Rust tests (240 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract create-file, create-directory, rename and directory-descendant
  policy into `src-tauri/src/modules/fs/mutate_paths.rs`, preserving all
  `fs_create_*`/`fs_rename` generated Tauri command symbols and the historical
  `mutate::*` imports used by clipboard import.
- [x] Verify filesystem-focused tests (10), full Rust tests (242 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract the macOS Finder clipboard URL reader and non-macOS fallback into
  `src-tauri/src/modules/fs/clipboard_paths.rs`, preserving
  `fs_clipboard_paths` and its generated Tauri command symbol.
- [x] Verify filesystem-focused tests (14), full Rust tests (242 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [ ] Keep `fs/mutate.rs` as a composition facade; only revisit it if import,
  trash or path mutation gains another concrete policy seam.

## Filesystem file/preview progress

- [x] Extract image/video MIME detection, size limits, base64 data URL
  serialization and preview commands into
  `src-tauri/src/modules/fs/file_preview.rs`, preserving `ImageData`,
  `fs_read_image`, `fs_read_video` and generated Tauri command symbols.
- [x] Keep text reading, atomic writing, stat and canonicalization in
  `fs/file.rs`; verify filesystem tests (14), full Rust tests (243 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [x] Extract bounded text reading, binary sniffing and `ReadResult` payload
  projection into `src-tauri/src/modules/fs/file_read.rs`, preserving
  `fs_read_file` and its compatibility re-export.
- [x] Verify filesystem-focused tests (14), full Rust tests (244 passed,
  2 ignored), `cargo check`, Clippy and diff hygiene.
- [ ] Keep the remaining 158-line `fs/file.rs` focused on atomic write, stat,
  canonicalization and folder selection; split only for a new policy seam.

## Network security progress

- [x] Extract URL scheme/userinfo validation, DNS/IP classification, metadata
  blocking, header sanitization, DNS pinning and redirect policy into
  `src-tauri/src/modules/net_security.rs`, preserving the HTTP proxy commands
  and payloads in `net.rs`.
- [x] Move security policy tests with the implementation and verify focused net
  tests (8), full Rust tests (239 passed, 2 ignored), `cargo check`, Clippy and
  diff hygiene.
- [x] Extract HTTP request/stream proxy commands, response/event DTOs and
  response-header projection into `src-tauri/src/modules/net_http.rs`, keeping
  `net.rs` as the `lm_ping`/compatibility facade.
- [x] Preserve `ai_http_request`, `ai_http_stream` command symbols and payloads;
  verify full Rust tests (239 passed, 2 ignored), `cargo check`, Clippy and diff
  hygiene.
- [ ] Keep the security seam single-path; do not add alternate URL or header
  validation in future HTTP command adapters.

## Native speech progress

- [x] Extract the Windows SAPI/PowerShell speech backend into
  `src-tauri/src/modules/speech_windows.rs`, keeping command dispatch and
  speech event names in `speech.rs` unchanged.
- [x] Verify macOS speech tests (5), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract native speech Tauri command adapters into
  `src-tauri/src/modules/speech_commands.rs`, preserving command names,
  generated symbols and platform fallback behavior.
- [x] Verify macOS speech tests (5), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract macOS speech bundle detection, permission messaging, retry policy
  and Speech-framework error mapping into
  `src-tauri/src/modules/speech_macos_support.rs`, preserving the inline audio
  engine/session lifecycle and event names.
- [x] Verify macOS speech tests (5), host `cargo check`, host Clippy and
  scoped formatting/diff hygiene.
- [x] Extract macOS `SpeechSession` ownership and thread-local request/session
  registry into `src-tauri/src/modules/speech_macos_state.rs`, preserving the
  main-thread lifecycle and event flow in `speech.rs`.
- [x] Verify speech-focused tests (5), full Rust tests (251 passed, 2 ignored),
  host `cargo check`, host Clippy and scoped formatting/diff hygiene.
- [x] Extract and harden the remaining macOS audio-engine callback/lifecycle
  behind a main-thread `SpeechLifecycle`; stale level/result/error callbacks
  are fenced and late stop completion cannot duplicate `speech-stopped`.
- [x] Fence buffered Windows speech stdout events by active session identity
  with host-neutral lifecycle tests. Windows cross-check remains blocked by
  the host lacking the MSVC C toolchain: `ring` fails on missing `assert.h`.

## PTY shell initialization progress

- [x] Extract Unix shell detection, PATH resolution, shell integration file
  preparation and command construction into
  `src-tauri/src/modules/pty/shell_init_unix.rs`, preserving the parent
  `shell_init::build_command` and `available_shells` interfaces.
- [x] Verify PTY-focused tests (52), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [ ] Audit the remaining Windows/Wsl shell builder for a platform seam only
  with Windows compile/test coverage.

## Remote authentication progress

- [x] Extract HMAC session-token issue/verify, claims validation, issuer checks
  and expiry handling into `src-tauri/src/modules/remote_auth_tokens.rs`,
  preserving the `RemoteAuth` public methods and token wire shape.
- [x] Extract per-client failed-auth window tracking and reset policy into
  `src-tauri/src/modules/remote_auth_rate_limit.rs`, preserving the 5-attempt /
  60-second semantics and password-reset clear path.
- [x] Extract scrypt password hashing, verifier validation and password
  verification into `src-tauri/src/modules/remote_auth_password.rs`, preserving
  parameters, verifier format and error mapping.
- [x] Extract bootstrap secret generation, SHA-256 hashing and constant-time
  used/expiry/secret verification into `src-tauri/src/modules/remote_auth_bootstrap.rs`,
  preserving bootstrap transition order and five-minute TTL.
- [x] Verify remote-auth tests (8), remote-focused tests (73), full Rust tests
  (259 passed, 2 ignored), `cargo check`, Clippy and diff hygiene. The one
  earlier parallel WebSocket timeout was not reproducible in three reruns;
  isolated and single-threaded runs passed.
- [ ] Keep `remote_auth.rs` as the state coordinator and token verification on
  the single `remote_auth_tokens.rs` path.

## Remote server progress

- [x] Extract LAN interface enumeration, route fallback and candidate selection
  into `src-tauri/src/modules/remote/server_network.rs`, preserving the server
  facade helpers used by remote status and focused tests.
- [x] Verify remote-focused tests (67), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract the HTTP/WebSocket request router into
  `src-tauri/src/modules/remote/server_router.rs`, preserving the historical
  `server::handle_connection` seam and all protocol/auth/static-asset routes.
- [x] Keep listener bind/accept-loop ownership in the 80-line `server.rs`; verify
  remote-focused tests (67), full Rust tests (239 passed, 2 ignored), `cargo
  check`, Clippy and diff hygiene.
- [x] Extract WebSocket upgrade/header/origin validation, bearer extraction,
  remote HTTP authorization and legacy route rejection into
  `src-tauri/src/modules/remote/http_security.rs`, keeping one security seam for
  the router and WebSocket adapters.
- [x] Verify remote-focused tests (67), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract remote UI directory selection, asset traversal/Spa fallback,
  content types, state/error responses and fallback HTML into
  `src-tauri/src/modules/remote/http_assets.rs`, preserving asset path and
  response behavior.
- [x] Verify remote-focused tests (67), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [x] Extract raw HTTP request parsing, request/response framing, query decoding
  and remote session-id conversion into
  `src-tauri/src/modules/remote/http_protocol.rs`, keeping `http.rs` as a
  23-line compatibility facade.
- [x] Verify remote-focused tests (67), full Rust tests (239 passed, 2 ignored),
  `cargo check`, Clippy and diff hygiene.
- [ ] Audit `server_router.rs` route groups only with protocol contract coverage;
  do not split its security or WebSocket upgrade path without route tests.

## Remote provider progress

- [x] Extract remote settings-store lookup and configured/disabled CLI-agent ID
  parsing into `src-tauri/src/modules/remote/provider_config.rs`, keeping the
  static provider catalog and response projection in `providers.rs`.
- [x] Verify remote-focused tests (69), full Rust tests (253 passed, 2 ignored),
  `cargo check --all-targets --locked`, Clippy and diff hygiene.
- [ ] Keep the static provider catalog stable; only change it with an explicit
  provider response contract update.

## Remote tunnel progress

- [x] Extract SSH/cloudflared provider selection, launch arguments, trusted
  public URL parsing, origin registration parsing and hostname resolution into
  `src-tauri/src/modules/remote_tunnel_provider.rs`.
- [x] Preserve tunnel supervisor/retry state in `remote_tunnel.rs` and provider
  test helpers at their historical module path; verify focused tunnel tests
  (9), full Rust tests (239 passed, 2 ignored), `cargo check`, Clippy and diff
  hygiene.
- [ ] Keep provider URL parsing and readiness signals behind this one adapter;
  do not duplicate trusted-host policy in supervisor code.

## Remote relay progress

- [x] Extract durable relay identity load/create, token generation and endpoint
  construction into `src-tauri/src/modules/remote_relay_identity.rs`.
- [x] Extract relay admission, heartbeat connection loop, device multiplexing
  and loopback bridge into `src-tauri/src/modules/remote_relay_connection.rs`,
  keeping `remote_relay.rs` as the lifecycle/heartbeat facade.
- [x] Preserve relay protocol and identity behavior; verify relay tests (2),
  full Rust tests (239 passed, 2 ignored), `cargo check`, Clippy and diff
  hygiene.
- [ ] Add protocol fixture coverage before changing relay control messages or
  device bridge ownership.

## Phase 3 progress

- [x] Extract background media loading/playback into
  `src/modules/architecture/components/CanvasBackgroundMedia.tsx`.
- [x] Extract canvas focus, toolbar, and tool button controls into focused
  components.
- [x] Extract selection handles, connector handles, and lock badge renderers.
- [x] Extract `DiagramNode`, `DiagramEdge`, and `CanvasDiagramSvg` renderers
  without moving PTY or camera ownership.
- [x] Extract ranked/free terminal placement UI into
  `src/modules/architecture/components/CanvasPlacementOverlay.tsx`.
- [x] Extract bounded undo/capture/restore lifecycle into
  `src/modules/architecture/lib/useCanvasHistory.ts`.
- [x] Extract pure drawing, snapping, resize/rotate, size-policy and
  shortcut-target logic into
  `src/modules/architecture/lib/architectureCanvasModel.ts`.
- [x] Extract node/edge selection transitions and multi-select invariants into
  `src/modules/architecture/lib/useCanvasSelection.ts`.
- [x] Extract canvas tool/placement keyboard lifecycle into
  `src/modules/architecture/lib/useCanvasToolShortcuts.ts`.
- [x] Extract drawing/resize/rotate/connector gesture state and pointer updates
  into `src/modules/architecture/lib/useCanvasShapeGestures.ts`.
- [x] Extract dock divider rendering into
  `src/modules/architecture/components/CanvasDockDivider.tsx`.
- [x] Extract shared terminal dock group controls into
  `src/modules/architecture/components/CanvasTerminalGroupHeader.tsx`.
- [x] Extract the shared terminal/browser selection and resize overlay into
  `src/modules/architecture/components/CanvasSurfaceSelectionOverlay.tsx`.
- [x] Extract canvas status and focus chrome into
  `src/modules/architecture/components/CanvasStatusOverlay.tsx`.
- [x] Extract terminal node positioning, visibility, PTY handle registration,
  surface callbacks and selection overlay into
  `src/modules/architecture/components/CanvasTerminalSurface.tsx`.
- [x] Extract browser surface positioning, visibility, callbacks and selection
  overlay into `src/modules/architecture/components/CanvasBrowserSurface.tsx`.
- [x] Extract terminal-world and browser-world composition into
  `src/modules/architecture/components/CanvasTerminalLayer.tsx` and
  `src/modules/architecture/components/CanvasBrowserLayer.tsx`.
- [x] Move the immutable architecture shape catalog into
  `src/modules/architecture/lib/architectureShapeCatalog.ts`.
- [x] Move diagram seed normalization, node/edge factories and legacy terminal
  migration into `src/modules/architecture/lib/architectureDiagramSeed.ts`.
- [x] Extract terminal directional navigation and maximize keyboard lifecycle
  into `src/modules/architecture/lib/useCanvasTerminalNavigation.ts`.
- [x] Extract diagram persistence effect into
  `src/modules/architecture/lib/useCanvasDiagramPersistence.ts` with focused
  source coverage.
- [x] Extract node/edge deletion, lock and connection lifecycle into
  `src/modules/architecture/lib/useCanvasNodeActions.ts` with focused source
  coverage.
- [x] Extract live-surface placement anchor selection into
  `src/modules/architecture/lib/architectureCanvasModel.ts` with direct
  behavior coverage.
- [x] Extract inherited terminal cwd selection into
  `src/modules/architecture/lib/architectureCanvasModel.ts` with direct
  behavior coverage.
- [x] Extract Delete/Backspace keyboard lifecycle into
  `src/modules/architecture/lib/useCanvasDeleteShortcut.ts` with source
  contract coverage.
- [x] Extract Cmd/Ctrl+Z keyboard lifecycle into
  `src/modules/architecture/lib/useCanvasUndoShortcut.ts` with source
  contract coverage.
- [x] Extract frame-attached terminal group movement policy into
  `src/modules/architecture/lib/architectureCanvasModel.ts` with direct
  behavior coverage.
- [x] Extract live-surface dock-target projection into
  `src/modules/architecture/lib/useCanvasSurfaceDockTarget.ts` with source
  contract coverage.
- [x] Extract canvas text creation/editing lifecycle into
  `src/modules/architecture/lib/useCanvasTextEditing.ts` with source contract
  coverage.
- [x] Extract terminal dock/detach/frame-sync commit policy into
  `src/modules/architecture/lib/useCanvasTerminalInteractions.ts` with source
  contract coverage.
- [x] Extract canvas pointer-down branching into
  `src/modules/architecture/lib/useCanvasPointerDown.ts` with source contract
  coverage.
- [x] Extract drag-move snapshot calculation into
  `src/modules/architecture/lib/architectureCanvasModel.ts` with direct
  behavior coverage.
- [x] Extract node pointer-down mode routing and drag capture into
  `src/modules/architecture/lib/useCanvasNodePointerDown.ts` with source
  contract coverage.
- [x] Extract edge pointer-down mode routing into
  `src/modules/architecture/lib/useCanvasEdgePointerDown.ts` with source
  contract coverage.
- [x] Extract terminal group-header pointer-down routing into
  `src/modules/architecture/lib/useCanvasTerminalGroupPointerDown.ts` with
  source contract coverage.
- [x] Extract canvas pointer-move orchestration into
  `src/modules/architecture/lib/useCanvasPointerMove.ts` with source contract
  coverage.
- [x] Extract canvas pointer-end/drop cleanup lifecycle into
  `src/modules/architecture/lib/useCanvasPointerEnd.ts` with source contract
  coverage.
- [x] Extract docked surface creation and dock-model transition into
  `src/modules/architecture/lib/architectureDiagramSeed.ts` with direct
  behavior coverage.
- [x] Extract terminal-group close commit policy into
  `src/modules/architecture/lib/useCanvasTerminalInteractions.ts` with source
  contract coverage.
- [x] Extract surface placement planning and creation actions into
  `src/modules/architecture/lib/useCanvasSurfacePlacementActions.ts` with
  source contract coverage.
- [x] Extract drop, placement and status overlays into
  `src/modules/architecture/components/CanvasInteractionOverlays.tsx` with
  source contract coverage.
- [x] Extract dock-divider pointer-down lifecycle into
  `src/modules/architecture/lib/useCanvasDockDividerPointerDown.ts` with
  source contract coverage.
- [x] Extract terminal-layer callback/action composition into
  `src/modules/architecture/lib/useCanvasTerminalLayerActions.ts` with source
  contract coverage.
- [x] Extract browser-layer callback/action composition into
  `src/modules/architecture/lib/useCanvasBrowserLayerActions.ts` with source
  contract coverage.
- [x] Extract legacy terminal-size migration lifecycle into
  `src/modules/architecture/lib/useCanvasTerminalSizeMigration.ts` with source
  contract coverage.
- [x] Extract derived terminal dock layouts/maps into
  `src/modules/architecture/lib/useCanvasTerminalViewModel.ts` with source
  contract coverage.
- [x] Extract diagram snapshot/restore history lifecycle into
  `src/modules/architecture/lib/useCanvasDiagramHistory.ts` with source
  contract coverage.
- [x] Extract non-live drag state transition into
  `src/modules/architecture/lib/architectureCanvasModel.ts` with direct
  behavior coverage.
- [x] Extract shared terminal/browser surface-node creation into
  `src/modules/architecture/lib/architectureDiagramSeed.ts` with direct
  behavior coverage.
- [x] Extract node creation policy into
  `src/modules/architecture/lib/architectureDiagramSeed.ts` with direct
  behavior coverage.
- [x] Move shared canvas types into
  `src/modules/architecture/lib/architectureCanvasTypes.ts`.
- [x] Update source invariants to follow the new component seams.
- [x] Run full frontend tests (726), relay tests (6), TypeScript and build.
- [x] Add focused placement-overlay coverage; full frontend suite now has 683
  passing tests.
- [x] Add focused shape-gesture coverage; full frontend suite now has 684
  passing tests.
- [x] Keep remaining `ArchitectureCanvas.tsx` stateful interaction wiring at
  the composition root after extracting camera, selection, node actions,
  pointer phases, docking, text editing, terminal navigation, and layer-action
  hooks; no aggregate interaction hook is introduced.
- [x] Extract diagram seed normalization, node/edge/dock-group state, and ID
  sequence ownership into `useCanvasDiagramState.ts`; preserve the canvas
  composition root as the owner of interaction policy.

## Phase 4 progress

- [x] Extract terminal-list presentation, keyboard focus, close actions, agent
  switcher and terminal-limit feedback into
  `src/modules/workspaces/WorkspaceTerminalList.tsx` with source coverage.
- [x] Extract `WorkspaceRow.tsx` plus shared row primitives for rename,
  expand/select, color picker and close behavior.
- [x] Extract `WorkspaceSetupView.tsx` for folder, layout, agent and import
  session setup state; keep workspace ownership in the panel/controller.
- [x] Extract pure setup path/count/agent-plan helpers into
  `src/modules/workspaces/lib/workspaceSetupModel.ts` with direct behavior
  coverage.
- [x] Extract `WorkspaceSetupLayoutStep.tsx` for workspace identity, mode,
  folder, recent-folder and terminal-layout controls with dedicated source
  coverage.
- [x] Extract `WorkspaceAgentSelectionGrid.tsx` for agent terminal counts,
  launch-command editing and custom command controls with dedicated source
  coverage.
- [x] Extract `WorkspaceAgentAssignmentSummary.tsx` for assignment progress,
  regular-terminal feedback, worktree isolation and imported-session removal.
- [x] Extract `WorkspaceSetupFooter.tsx` for setup navigation and launch
  gating without moving workspace actions or persistence.
- [x] Extract `WorkspaceForkSetup.tsx` for the forked-agent prompt surface;
  keep fork lifecycle and workspace creation in `WorkspaceSetupView.tsx`.
- [x] Extract `useWorkspaceSetupAgentCapacity.ts` for terminal-capacity
  clamping and agent-count synchronization with focused source coverage.
- [x] Extract `useWorkspaceSetupCommandPersistence.ts` for custom-command
  hydration/debounce and agent launch-command persistence.
- [x] Extract `useWorkspaceSetupFolder.ts` for working-folder hydration,
  folder browsing and `cd` command application.
- [x] Extract `useWorkspaceSetupKeyboardShortcuts.ts` for Escape/Enter
  handling, editable-target guards and listener cleanup.
- [x] Extract `useWorkspaceSetupOpenWorkspace.ts` for workspace payload
  assembly and launch/cancel callback coordination.
- [x] Extract `useWorkspaceSetupAgentSelectionSync.ts` for fork initialization
  and selected-agent fallback synchronization.
- [x] Move effective command resolution and launch-command planning into pure
  `workspaceSetupModel.ts` helpers with regression coverage.
- [x] Extract `useWorkspaceSetupImportSelection.ts` for active-session,
  duplicate and capacity validation before import.
- [x] Extract `useWorkspaceSetupIdentitySync.ts` for suggested workspace name
  and accent-color synchronization.
- [x] Extract `useWorkspaceTerminalDrag.ts` for terminal hit-testing, pointer
  lifecycle, swap targeting, and cleanup while keeping sidebar rendering in
  `WorkspacesPanel.tsx`.
- [x] Extract `useWorkspaceReorderDrag.ts` for workspace-row pointer lifecycle,
  placement preview, reorder policy, and cleanup while keeping placeholder and
  preview rendering in `WorkspacesPanel.tsx`.
- [x] Extract `WorkspacePanelHeader.tsx` for workspace creation and agent
  session-import menu actions while keeping workspace state in
  `WorkspacesPanel.tsx`.
- [x] Extract `WorkspaceList.tsx` for workspace-row and expandable terminal
  list rendering while keeping list state, drag coordination, and portal
  overlays in `WorkspacesPanel.tsx`.
- [x] Extract `WorkspaceDragOverlays.tsx` for terminal/workspace drag previews
  rendered through `document.body` while keeping drag state and target lookup
  in the dedicated hooks.
- [x] Extract `useCanvasTerminalTabState.ts` for active-terminal reporting,
  terminal-tab activation, and surviving-tab transitions while keeping pure
  drag/drop and group-close policy in `useCanvasTerminalInteractions.ts`.
- [x] Extract `useCanvasDiagramViewModel.ts` for selected-node/edge lookup,
  node indexing, and live-surface classification while keeping diagram state
  ownership in `ArchitectureCanvas.tsx`.
- [x] Extract pure terminal tab/drop decisions into
  `canvasTerminalInteractionModel.ts`, leaving state mutations in
  `useCanvasTerminalInteractions.ts` and preserving compatibility re-exports.
- [x] Extract terminal state mutations into
  `canvasTerminalInteractionCommit.ts`, leaving
  `useCanvasTerminalInteractions.ts` as a compatibility facade.
- [x] Extract canvas node-kind predicates and keyboard-target guards into
  `architectureCanvasPredicates.ts`, preserving compatibility re-exports from
  `architectureCanvasModel.ts`.
- [x] Extract node-kind technology labels into `architectureNodeDefaults.ts`,
  preserving `defaultTechnology` compatibility re-exports from
  `architectureCanvasModel.ts`.
- [x] Extract shape defaults, sizing, rectangle normalization, and
  resize/rotation transitions into `architectureShapeModel.ts`, preserving
  compatibility re-exports from `architectureCanvasModel.ts`.
- [x] Extract directional terminal selection into
  `architectureTerminalNavigationModel.ts`, preserving compatibility
  re-exports from `architectureCanvasModel.ts`.
- [x] Extract immutable cloning and text-node sizing utilities into
  `architectureTextModel.ts`, preserving compatibility re-exports from
  `architectureCanvasModel.ts`.
- [x] Add direct behavior coverage for the extracted shape and terminal
  navigation policy modules.
- [x] Add direct behavior coverage for extracted text utilities and canvas
  kind predicates.
- [x] Extract surface placement anchor, inherited terminal cwd, and distance
  policy into `architectureSurfaceModel.ts`, preserving compatibility
  re-exports from `architectureCanvasModel.ts`.
- [x] Extract text/frame snapping and attached terminal dock-group movement
  into `architectureCanvasAttachmentModel.ts`, preserving compatibility
  re-exports from `architectureCanvasModel.ts`.
- [x] Add direct behavior coverage for attachment snapping and dock-group
  movement.
- [x] Extract pen/line/arrow/shape drawing transitions into
  `architectureDrawingModel.ts`, preserving compatibility re-exports from
  `architectureCanvasModel.ts`.
- [x] Extract bounded node drag transitions and attached dock-group movement
  into `architectureCanvasDragModel.ts`, preserving compatibility re-exports
  from `architectureCanvasModel.ts`.
- [x] Extract pure camera coordinate, pan-clamp, zoom, center, and wheel-delta
  math into `canvasCameraModel.ts`, preserving compatibility re-exports from
  `useCanvasCamera.ts`.
- [x] Extract guarded, idempotent wake/focus listener installation into
  `terminalWakeRebind.ts`, preserving visible-leaf rebind behavior in
  `useTerminalSession.ts`.
- [x] Extract terminal session state schema and initialization defaults into
  `terminalSessionModel.ts`, keeping PTY/renderer lifecycle orchestration in
  `useTerminalSession.ts`.
- [x] Extract shared activity-timer cleanup into `terminalSessionTimers.ts`,
  reusing it across respawn and disposal paths with direct behavior coverage.
- [x] Extract live-slot/snapshot buffer and selection readback into
  `terminalSessionReadback.ts`, preserving tail and null-selection semantics
  with direct behavior coverage.
- [x] Extract respawn state preparation into `terminalSessionRuntimeModel.ts`,
  keeping PTY close/open sequencing in `useTerminalSession.ts` with direct
  behavior coverage.
- [x] Extract initial command flush/fallback scheduling into
  `terminalSessionCommandLifecycle.ts`, preserving CR injection, agent
  metadata, and callback behavior with direct coverage.
- [x] Extract terminal visibility/focus and renderer-slot reacquisition policy
  into `terminalSessionVisibilityModel.ts`, preserving hidden-pane eviction
  behavior with direct coverage.
- [x] Extract slot snapshot capture and detached-session cleanup into
  `terminalSessionAttachment.ts`, preserving renderer rebind state with direct
  behavior coverage.
- [x] Extract response-output activity decisions into
  `terminalAgentOutputModel.ts`, keeping agent activity side effects in
  `useTerminalSession.ts` with direct behavior coverage.
- [x] Extract bounded font/startup readiness into `terminalSessionReady.ts`,
  keeping PTY/session creation behavior unchanged.
- [x] Extract imperative PTY/session registry and lifecycle orchestration into
  `terminalSessionRuntime.ts`, preserving `useTerminalSession` exports and
  updating lifecycle source contracts to cover both facade and runtime seams.
- [x] Extract React effect binding for session ensure/attach/detach and
  visibility/focus synchronization into `useTerminalSessionLifecycle.ts`,
  keeping runtime ownership and imperative input/readback actions in their
  existing seams.
- [x] Verify focused terminal source tests (25) and `pnpm build`; preserve the
  `useTerminalSession` public return shape and callback forwarding behavior.
- [x] Isolate the intentional renderer-serialization warning in its test while
  asserting the warning contract, keeping full-suite output free of misleading
  error logs.
- [x] Extract source-control action gating and feedback derivation into
  `sourceControlPanelModel.ts`, keeping Git state/actions owned by the panel
  hook and adding direct behavior coverage.
- [x] Extract staged/unstaged entry, merged file-row, status-code and header
  checkbox derivation into `sourceControlEntriesModel.ts`, preserving the
  `useSourceControlPanel` type contract through re-exports.
- [x] Extract pure optimistic stage, unstage and discard Git-status transitions
  into `sourceControlStatusMutations.ts`, including the renamed-file unstage
  expansion, while keeping IPC, cache invalidation and reconcile lifecycle in
  `useSourceControlPanel.ts`.
- [x] Extract selected-diff equality and staged/unstaged reconciliation into
  `sourceControlSelectionModel.ts`, preserving the panel hook's selection
  transition feedback and public type export.
- [x] Extract Source Control mutation runner behavior (optimistic status,
  diff-cache invalidation, reconcile scheduling and IPC rollback refresh) into
  `useSourceControlMutation.ts`, keeping operation-specific actions in the
  panel hook.
- [x] Extract repository/status header and Commit Graph presentation into
  `SourceControlPanelHeader.tsx`, keeping remote action/state ownership in the
  panel.
- [x] Extract agent draft/file/history prompt composition into
  `agentChatPromptModel.ts`, keeping submit/steer side effects in
  `AgentChatWorkspace.tsx` with direct behavior coverage.
- [x] Extract Agent Chat submit/steer orchestration into
  `useAgentChatSubmit.ts`, keeping native baseline capture and edit rollback
  behavior intact.
- [x] Extract terminal placement obstacle derivation into
  `canvasDockingModel.ts`, keeping collision policy separate from docking
  pointer/resize lifecycle.
- [x] Extract canvas-to-client dock-target projection and resolution into
  `canvasDockingModel.ts`, keeping DOM/state publication in
  `useCanvasDocking.ts`.
- [x] Extract dock-divider ratio clamping and keyboard-step policy into
  `canvasDockDividerModel.ts`, keeping RAF/state lifecycle in
  `useCanvasDocking.ts`.
- [x] Extract dock-divider RAF/pointer/keyboard resize lifecycle into
  `useCanvasDockDividerResize.ts`, keeping dock-target state in
  `useCanvasDocking.ts`.
- [x] Extract shape/surface node construction into
  `architectureNodeFactory.ts`, preserving compatibility re-exports from
  `architectureDiagramSeed.ts` and keeping persisted seed normalization
  separate.
- [x] Extract persisted diagram validation and legacy terminal-size migration
  into `architectureDiagramNormalization.ts`, preserving seed compatibility
  exports and serialized field behavior.
- [x] Add direct behavior coverage for diagram normalization and camera math
  invariants.
- [x] Extract persisted terminal dock-group validation, duplicate-membership
  repair, ID allocation and orphan restoration into
  `terminalDockNormalization.ts`, preserving `terminalDockLayout.ts` imports
  through a compatibility re-export.
- [x] Extract terminal dock stack/divider layout, maximized projection, drop
  edge resolution and indicator geometry into `terminalDockGeometry.ts`,
  preserving the facade exports used by Canvas and its layers.
- [x] Extract terminal dock tree mutations (remove, dock, detach, activate,
  bounds and split-ratio updates) into `terminalDockMutations.ts`, preserving
  the facade exports and direct mutation behavior coverage.
- [x] Extract the File Explorer root header and its search/create/refresh
  controls into `FileExplorerHeader.tsx`, keeping tree state and file actions
  owned by `FileExplorer.tsx`.
- [x] Extract the Tauri native drag/drop listener lifecycle into
  `useFileExplorerNativeDrop.ts`, keeping explorer destination resolution and
  file-tree ownership in `FileExplorer.tsx`.
- [x] Extract Explorer clipboard copy/paste routing into
  `useFileExplorerClipboard.ts`, preserving internal-path, browser-file and
  native Finder fallbacks while keeping selection/tree ownership in the root.
- [x] Extract Explorer keyboard navigation and command routing into
  `useFileExplorerKeyboard.ts`, keeping selection, tree and file actions in
  `FileExplorer.tsx`.
- [x] Extract Explorer internal drag hit-testing, target validation and move
  commit lifecycle into `useFileExplorerInternalDrag.ts`, keeping tree/move
  ownership in `FileExplorer.tsx`.
- [x] Extract Explorer range-selection, focused-path cleanup and root reset
  lifecycle into `useFileExplorerSelection.ts`, keeping tree actions and UI in
  `FileExplorer.tsx`.
- [x] Extract remote native-device pairing list/start/revoke lifecycle into
  `useRemoteDevicePairing.ts`, keeping tunnel state and settings presentation
  in `GeneralSection.tsx`.
- [x] Extract selected STT health probing, staged-provider fallback and retry
  cleanup into `useSpeechToTextHealth.ts`, keeping provider/key/model UI in
  `ModelsSection.tsx`.
- [x] Extract terminal preference controls into
  `TerminalPreferencesSection.tsx`, keeping shell discovery and General
  settings composition in `GeneralSection.tsx`.
- [x] Extract TabBar pointer drag threshold, preview placement, reorder/click
  resolution and global pointer listener cleanup into `useTabBarDrag.ts`,
  keeping tab rendering and public tab actions in `TabBar.tsx`.
- [x] Extract Music CLI playback polling and interval cleanup into
  `useTabBarMusicState.ts`, keeping playback presentation in `TabBar.tsx`.
- [x] Extract tab icon, label, agent-state and unsaved-indicator presentation
  into `TabBarTabContent.tsx`, keeping drag/menu orchestration in `TabBar.tsx`.
- [x] Extract Git history near-bottom loading, viewport auto-fill and timer
  cleanup into `useGitHistoryInfiniteScroll.ts`, keeping history data and row
  presentation in `GitHistoryPane.tsx`.
- [x] Extract incremental Git graph cache/rebuild policy into
  `useGitHistoryGraph.ts`, preserving delta layout on pagination and reset on
  a changed newest commit.
- [x] Extract Bottom Terminal drawer resize clamping, RAF batching and pointer
  cleanup into `useBottomTerminalResize.ts`, keeping drawer tabs and PTY
  ownership in `BottomTerminalDrawer.tsx`.
- [x] Extract Bottom Terminal tab drag threshold, hit-testing, focus and reorder
  cleanup into `useBottomTerminalTabDrag.ts`, keeping drawer tab/PTY ownership
  in `BottomTerminalDrawer.tsx`.
- [x] Extract `WorkspaceSetupAgentsStep.tsx` for agent assignment, CLI selection,
  and session import composition while keeping hydration, persistence, and
  selection ownership in `WorkspaceSetupView.tsx`.
