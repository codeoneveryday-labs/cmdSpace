# Architecture Scale Hardening Implementation Plan

> **For agentic workers:** Use the existing seam and lifecycle contracts before introducing new abstractions. Execute each phase as an independently verifiable change group; preserve unrelated worktree changes.

**Goal:** Raise cmdSpace from a well-structured desktop monolith to a more team-scale, cross-platform, contract-safe architecture without changing user-visible behavior or moving the existing sources of truth.

**Architecture:** Keep the React/Tauri Bridge, native command Facade, pane/canvas Composite models, renderer Flyweight, and explicit PTY/agent State owners. Deepen only the remaining policy seams, replace brittle structural proof with behavior/contract proof, and introduce migration/concurrency discipline before optimizing for broader parallelism.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri 2, Rust 2021, portable-pty, SQLite/rusqlite, pnpm, Cargo.

---

**Relationship:** This plan carries the future-facing architecture work out of
the stabilization plan at
[`2026-08-31-refactor-stabilization.md`](2026-08-31-refactor-stabilization.md);
that plan remains the evidence record for the completed test/lifecycle fixes.

## Scope and constraints

- Current worktree is user-owned and already contains a large multi-agent refactor. Never reset, clean, or overwrite unrelated changes.
- Do not delete files without explicit permission.
- No new dependency is assumed.
- Preserve all `agent_chat_*`, `pty_*`, `fs_*`, `git_*`, `remote_*`, `speech_*`, and `db_*` command names and serialized payloads.
- Keep `App.tsx`/`useTabs` as workspace/tab/pane owners.
- Keep standard terminal PTYs on the renderer-pool path and canvas terminals on private xterm/PTy paths.
- Keep live handles/processes out of SQLite, canvas snapshots, and undo history.

## Requirements summary

1. Document and stabilize the architectural contract for future agents.
2. Add behavior-level proof for remaining lifecycle-heavy frontend seams.
3. Isolate native platform/window policy without bypassing the command Facade.
4. Make persistence and concurrency evolution explicit before scaling usage.
5. Add platform and integration gates that reflect the actual risk surface.

## Acceptance criteria

- The scale-readiness document and this plan remain linked from the refactor roadmap and name concrete owners/invariants.
- `useWhisperRecording` behavior has direct tests for native start/stop, cloud capture, empty audio, transcription failure fallback, cancellation, and listener cleanup.
- Window-surface decomposition preserves the existing command registry and passes platform-gated source/contract tests.
- Explorer/import decomposition preserves path normalization, mutation ordering, selection state, and cleanup behavior with direct tests.
- SQLite schema changes use explicit migration progression or a documented decision not to change the current strategy; old-schema fixtures pass.
- Agent Chat concurrency tests prove one provider runtime per durable `chatId`, per-chat serialization semantics, detach-without-kill, replay ordering, and explicit close cleanup before any lock narrowing.
- Windows/WSL and macOS-sensitive seams have target-platform compile/runtime evidence or an explicit documented environment gap.
- `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, `cargo fmt --all -- --check`, `cargo check --all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`, and `git diff --check` pass for each completed change group.
- No change group stages or commits unrelated multi-agent worktree files.

## File ownership map

| Change group | Primary files | Keep ownership in |
|---|---|---|
| Contract proof | `src-tauri/src/commands.rs`, `src/modules/ai/lib/native.ts`, `src-tauri/capabilities/` | Rust command registry + typed frontend bridge |
| Voice lifecycle | `src/modules/ai/hooks/useWhisperRecording.ts`, new pure voice model/tests | Hook owns UI state; adapters own capture/transcription effects |
| Window surfaces | `src-tauri/src/window_commands.rs`, new platform seam files, `src-tauri/src/lib.rs` tests | `window_commands` compatibility facade and Tauri managed state |
| Explorer/import | `src/modules/explorer/lib/useFileTree.ts`, `TreeRow.tsx`, `FileExplorer.tsx`, `ImportSessionDialog.tsx` | Explorer/workspace modules; no App-level tree state |
| Persistence | `src-tauri/src/modules/db/schema.rs`, `src-tauri/src/modules/db/` fixtures/tests | SQLite initialization/migration seam |
| Agent concurrency | `src-tauri/src/modules/agent_chat/{runtime.rs,daemon.rs,event_sink.rs,session_commands.rs}` | `AgentChatRuntime` and durable `chatId` mapping |
| Platform validation | `src-tauri/src/modules/speech.rs`, `speech_*`, `pty/shell_init.rs`, `shell_init_unix.rs` | Platform adapter seams; no frontend native bypass |

## Phase 0 — Baseline and integration boundary

- [x] Capture the current worktree inventory with `git status --short --untracked-files=all`, `git diff --stat`, and branch/worktree listing.
- [x] Classify files into existing refactor groups before staging anything: App/canvas, Agent Chat, remote, workspace/database, PTY, filesystem/Git, settings/voice, and docs.
- [x] Record the currently passing gates and any platform-specific gaps in the change group that owns them.
- [x] Treat `docs/architecture/scale-readiness.md` as the shared review vocabulary for subsequent agents.

Expected result: every later patch names its owning group, source of truth, lifecycle owner, and proof command.

### Recorded baseline — 2026-08-31

- Main worktree: `main` at `27e6fb39`; 95 tracked paths modified and 695
  untracked paths. The refactor diff reports 4,102 insertions and 33,522
  deletions across the tracked paths.
- Ownership classification: App/canvas/settings (365 paths), native/workspace/
  terminal/filesystem/Git (265), Agent Chat (94), remote/protocol (44), docs/
  guidance (8), and other existing worktree paths (14). Do not stage across
  these groups without an explicit integration review.
- Passing baseline gates: `pnpm exec tsc --noEmit`; `pnpm test` (1,091 frontend
  tests and 6 relay tests); `pnpm build`; `cargo fmt --all -- --check`; `cargo
  check --all-targets --locked`; `cargo clippy --all-targets --locked -- -D
  warnings`; and `git diff --check`.
- Known platform gaps: Windows/WSL native compile/smoke coverage requires an
  actual Windows/MSVC environment; the macOS audio-engine callback still needs
  native runtime lifecycle evidence. Existing prunable historical worktrees
  are not part of this change group.

## Phase 1 — Replace brittle proof with contract and behavior coverage

**Files:** existing `*.source.test.ts`, `*.source.test.tsx`, `src/modules/ai/lib/`, `src-tauri/src/modules/*_test.rs`.

- [ ] Inventory source-contract tests that assert file paths or implementation strings; classify each assertion as structural invariant, wire contract, or behavior claim. Initial taxonomy and migration priorities are recorded in [`2026-08-31-source-contract-inventory.md`](../../reports/2026-08-31-source-contract-inventory.md).
- [ ] Keep structural assertions only for command registration, ownership boundaries, and platform guards.
- [ ] Move behavior claims to direct model/hook/Rust tests with injected ports where the current code already has a natural seam.
- [x] Add a contract fixture check that compares static frontend command names
  and payload keys against the registered Rust Tauri command declarations,
  without requiring a new runtime dependency.
- [x] Run focused tests, then the full frontend/relay suite before starting the next phase.

Exit proof: a harmless file move can update one structural test without requiring a production implementation string to remain in its old file, while command/payload drift still fails deterministically.

### Phase 1 contract fixture — 2026-08-31

- `src/lib/tauriCommandRegistry.contract.test.ts` scans production TypeScript
  `invoke` calls and the Rust `cmdspace_commands!` registration macro. It
  fails when a statically invoked command is not registered or when a static
  payload key does not map to a Rust command parameter after camel/snake case
  normalization. Managed Tauri parameters are read from the Rust signature but
  need not appear in a frontend payload.
- Focused proof: `pnpm exec vitest run
  src/lib/tauriCommandRegistry.contract.test.ts` passes (2 tests).
- Integration proof: `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm test`
  now pass. The full frontend suite reports 1,134 tests and the relay suite
  reports 6 tests.

### Phase 1 Canvas behavior-proof migration — 2026-09-01

- `ArchitectureStack.source.test.ts` now retains Canvas composition and UI
  ownership assertions, while direct model tests own frame-attached terminal
  movement, text sizing, edge overlap, and connector endpoint behavior.
- The direct attachment test proves a moved frame carries its attached dock
  group unless the terminal node itself is part of the moved set. This removes
  the prior source-string dependence on internal traversal details.
- Evidence: Canvas focused suite (39 tests), full frontend/relay suite (456
  files / 1,178 tests + 6 relay), production build, and `git diff --check`
  pass. The ArchitectureStack source contract dropped from 319 to 279 string
  assertions in this focused pass.

### Phase 1 Agent Chat behavior slice — 2026-08-31

- `appendVoiceTranscript` now belongs to the existing prompt model and has
  direct behavior tests for blank drafts and trailing whitespace. The
  workspace composition delegates this policy rather than embedding it in a
  hook callback.
- `AgentChatWorkspace.source.test.ts` now protects only the relevant
  structural ownership invariant: the workspace composes session/history/
  composer seams and never routes agent prompts through a terminal. It no
  longer scans unrelated child implementations for UI strings.
- Evidence: focused tests, `pnpm exec tsc --noEmit`, full frontend/relay suite
  (1,126 + 6), production build, and `git diff --check` pass.

### Phase 1 Remote session lifecycle behavior slice — 2026-08-31

- `remoteSessionLifecycleModel` owns remote-CWD normalization, active-session
  fallback, and the bounded retry budget for a newly created session.
  `RemoteApp` remains the React/WebSocket adapter that owns timers and client
  calls.
- The model has direct tests for trailing path separators, no selected folder,
  active-session fallback, and retry exhaustion. The remote UI source contract
  now protects the composition seam instead of embedding active-session search
  logic.
- Evidence: focused remote tests, `pnpm exec tsc --noEmit`, full frontend/
  relay suite (1,142 + 6), production build, and `git diff --check` pass.

### Phase 1 native device-pairing URL behavior slice — 2026-08-31

- `buildNativeDevicePairingUrl` is the Settings Adapter from a native pairing
  grant to the `cmdspace://device-pair` deep link. It preserves the prior
  query keys and `encodeURIComponent` semantics for remote URL, relay,
  relay ID, and grant secret.
- `GeneralSection` remains the pairing UI/controller; direct tests cover all
  encoded fields and the no-grant empty-link case.
- Evidence: focused Settings tests, full frontend/relay suite (1,144 + 6),
  production build, and `git diff --check` pass.

### Phase 1 native autostart persistence behavior slice — 2026-08-31

- `autostartPreferenceAdapter` isolates the native plugin Adapter from the
  persisted Settings preference. It owns native-to-persisted synchronization
  and enable/disable ordering; `GeneralSection` retains UI error handling and
  unmount lifecycle ownership.
- Direct tests cover mismatched/matching status, the unmount guard, native
  toggle ordering, and toggle failure before persistence. The unmount guard
  preserves the existing rule that a late native response never writes an
  unmounted Settings view's preference.
- Evidence: focused Settings tests, full frontend/relay suite (1,150 + 6),
  production build, and `git diff --check` pass.

### Phase 1 terminal pane drag lifecycle slice — 2026-08-31

- `useTerminalPaneDrag` now owns terminal-header pointer capture, document and
  window listener cleanup, Escape/blur cancellation, drop-target projection,
  swap commit, and focus restoration. `TerminalStack` owns terminal selection,
  renderer hydration, and passes the resulting `dragContext` to the tree.
- The hook re-exports the existing drag context interface through
  `PaneTreeView` for compatibility. Its pure preview geometry has direct tests;
  the tree test now reads the owning hook rather than requiring listener code
  to stay in `TerminalStack`.
- Evidence: terminal focused tests, full frontend/relay suite (1,154 + 6),
  production build, and `git diff --check` pass.

### Phase 1 terminal render-state projection slice — 2026-08-31

- `getTerminalPaneRenderState` is the terminal Composite/State read model for
  ordinary, maximized, and absent terminal tabs. It preserves persisted CWD,
  last-command, and auto-launch metadata when projecting a maximized leaf.
- `TerminalStack` remains the React coordinator for active-tab selection,
  renderer bundle binding, hydration, collaboration, and pane drag.
- Evidence: direct render-state tests, terminal focused tests, full
  frontend/relay suite (1,158 + 6), production build, and `git diff --check`
  pass.

### Phase 1 terminal input shortcut behavior slice — 2026-08-31

- `terminalInputShortcuts` owns pure Cmd/Ctrl editing sequence selection and
  the non-macOS copy chord. `rendererInput` remains the Adapter that handles
  xterm interception, clipboard writes, composition filtering, and PTY input.
- Direct tests cover full-line clear, word/backspace and suffix delete,
  Shift+Enter, ordinary Enter, and platform-specific copy behavior. The
  renderer source contract now protects its delegation instead of private
  predicate ordering.
- Evidence: focused terminal input tests, full frontend/relay suite
  (1,162 + 6), production build, and `git diff --check` pass.

## Phase 2 — Voice capture lifecycle seam

**Files:**

- Modify: `src/modules/ai/hooks/useWhisperRecording.ts`
- Create if justified by the tests: `src/modules/ai/lib/voiceCaptureModel.ts`, `src/modules/ai/lib/voiceCaptureModel.test.ts`
- Test: a direct hook/model test file under `src/modules/ai/`

- [x] Lock current behavior with tests for native start/stop, cloud `MediaRecorder` capture, zero-byte audio, speech-activity gating, transcription success, transcription failure fallback to native, cancel, and unmount cleanup.
- [x] Define a small capture port for `MediaRecorder`, `MediaStream`, `AudioContext`, Tauri `invoke`, and Tauri event listeners; keep browser/native effects outside pure transition logic.
- [x] Move only state transitions and cleanup decisions behind the pure seam; keep transcript callback ownership and public hook return shape unchanged.
- [x] Verify that every started stream, animation frame, interval, recorder, and Tauri listener has a matching cleanup path.
- [x] Run focused voice tests, `pnpm exec tsc --noEmit`, and `pnpm test`.

Exit proof: direct tests can drive success/failure/cancel without a real microphone, while the production hook still emits the existing speech events and returns the existing state shape.

### Phase 2 execution — 2026-08-31

- `voiceCaptureModel.ts` owns capture state transitions, bounded duration state,
  native/cloud fallback, and idempotent disposal. Its injected cloud port keeps
  microphone/browser effects out of the state machine.
- `voiceCloudCapture.ts` owns stream, recorder, analyzer and animation-frame
  lifecycles; `voiceCaptureListeners.ts` owns the three Tauri speech event
  subscriptions, including late-resolving listener cleanup.
- `useWhisperRecording.ts` remains the compatibility adapter for the existing
  hook API, Tauri commands and transcript callback ownership.
- Evidence: 19 direct model/adapter tests plus 20 existing voice source
  contracts, `pnpm exec tsc --noEmit`, `pnpm test` (1,112 frontend + 6 relay),
  and `pnpm build` pass.

### Phase 2 transcript insertion behavior slice — 2026-08-31

- `voiceTranscriptInsertionModel` now owns literal transcript delivery to a
  captured terminal target and returns a typed ready/error outcome. It covers
  missing targets, busy terminals, successful delivery, and thrown errors.
- `useSpeechToTextInput` remains the State/Timer adapter: it owns the
  insertion/ready phases and timeout cleanup, while the pure model owns no
  browser or React state.
- Evidence: 4 direct insertion tests; voice focused tests (46); full frontend
  suite (1,134 + 6 relay); production build; and `git diff --check` pass.

## Phase 3 — Native window-surface decomposition

**Files:**

- Modify: `src-tauri/src/window_commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands.rs`
- Create only after source ownership is mapped: `window_desktop_blur.rs`, `window_settings.rs`, `workspace_switcher.rs`, or equivalent focused seams
- Test: existing source tests in `lib.rs` and `src/tray/WorkspaceSwitcher.source.test.ts`, plus focused platform tests

- [x] Separate the concerns conceptually first: launch directory, settings window, desktop blur, webview corner radius, and macOS tray switcher.
- [x] Preserve the historical command symbols through a thin `window_commands` facade and keep `LaunchDir`/`DesktopBlurState` managed-state construction in `lib.rs`.
- [x] Move platform-unsafe code only with matching `cfg` boundaries; do not make unsupported platforms depend on macOS/Windows types.
- [x] Update source tests to read the owning seam instead of forcing implementation details back into the facade.
- [x] Verify native command registration, macOS Stage Manager invariants, Windows non-activating overlay invariants, and tray positioning tests.

Exit proof: command names and managed-state ownership remain unchanged; each native surface can be reviewed and tested without loading unrelated platform code.

### Phase 3 execution — 2026-08-31

- `window_commands.rs` is now the command-compatible facade. Focused seams own
  launch-directory parsing, settings-window construction, desktop blur,
  webview corner radius, and workspace-switcher/tray behavior.
- The facade preserves every command name and the `LaunchDir`/
  `DesktopBlurState` types consumed by `lib.rs`; `commands.rs` remains the
  sole command-registration source of truth.
- Evidence: native command registry contract (2 tests), tray source contract
  (7 tests), Rust native suite (259 passed, 2 live CLI tests ignored),
  `cargo fmt --all -- --check`, `cargo check --all-targets --locked`, and
  `cargo clippy --all-targets --locked -- -D warnings` pass. The Windows
  overlay test is source-level only; a real Windows target remains Phase 7.

## Phase 4 — Explorer tree and import-dialog seams

**Files:**

- Modify: `src/modules/explorer/lib/useFileTree.ts`, `src/modules/explorer/TreeRow.tsx`, `src/modules/explorer/FileExplorer.tsx`
- Modify: `src/modules/workspaces/ImportSessionDialog.tsx`
- Create only for complete policy clusters: `fileTreeData.ts`, `fileTreeMutations.ts`, `useTreeRowDrag.ts`, `importSessionDialogModel.ts`
- Test: direct model/hook tests plus existing explorer/workspace source tests

- [x] Lock path and lifecycle behavior for root reset, preference refetch, create/rename/delete/move/import/restore, pointer drag cancellation, and context-menu confirmation.
- [x] Keep filesystem effects behind the existing native bridge; pure destination/path/selection policy must not import DOM or invoke directly.
- [x] Move tree data loading and mutation orchestration apart only if both seams have explicit inputs/outputs and cleanup ownership.
- [x] Confirm the existing `importSessions` model already owns import-dialog filtering/selection policy, so a second dialog state store would not reduce component knowledge.
- [x] Verify explorer and import-session focused tests, then full frontend tests/build.

Exit proof: tree operations preserve mutation ordering and refresh behavior; import dialog remains a presentation/controller surface and does not gain a second workspace state store.

### Phase 4 execution — 2026-08-31

- `fileTreePaths.ts` now owns portable path joins/parents; it replaces the
  former incidental dependency on `useFileTree` from drop-destination policy.
- `fileTreeMutations.ts` is the native-bridge Adapter for create, rename,
  delete, move, import and restore. It owns mutation ordering, callback timing,
  best-effort delete/restore behavior, and post-success refreshes through an
  injected port. `useFileTree.ts` remains the React data/loading lifecycle
  owner and re-exports its historical path/type compatibility surface.
- `ImportSessionDialog` stays a controller/presentation layer because the
  existing `importSessions` pure model owns session filtering rules while
  `importSessionDialogModel.ts` now owns derived provider visibility,
  selected-session projection, and stable session keys; no parallel workspace
  state store was added.
- Evidence: 9 new direct path/state/mutation tests, existing direct
  selection/drag/drop/import-model coverage, and focused explorer/import
  tests; `pnpm exec tsc --noEmit`, `pnpm test` (1,121 frontend + 6 relay),
  `pnpm build`, and `git diff --check` pass.
- Deferred design debt: `FileExplorerHeader.tsx` and `FileExplorerRow.tsx`
  remain shallow presentation wrappers. Retiring them requires deleting or
  inlining files, which repository policy forbids until the user gives
  explicit written permission. Do not add artificial state to justify them.

## Phase 5 — Persistence and migration discipline

**Files:** `src-tauri/src/modules/db/schema.rs`, `src-tauri/src/modules/db/`, `src-tauri/src/modules/db/tests.rs`, related docs/decisions.

- [x] Inventory all current tables/columns and the order in which `init_db` applies additive changes.
- [x] Add legacy-schema fixture coverage for additive workspace/pane upgrades and assert initialization creates the recent-workspace, agent-config/cache, mobile-workspace, and setup-preferences tables.
- [x] Retain column probing for this hardening slice. Do not introduce `PRAGMA user_version` until a future ADR defines the historical-version baseline, recovery behavior, and the first non-additive migration boundary.
- [x] Keep every current migration additive and idempotent; the new `initialize_schema(&Connection)` seam makes the whole initialization sequence individually testable in memory.
- [x] Verify legacy upgrade, current round trips, and repeated initialization without deleting user data.

Exit proof: a schema upgrade can be replayed against fixtures and its resulting schema/data is observable; no migration silently changes serialized field names or table contracts.

### Phase 5 execution — 2026-08-31

- Current initialization order: `workspaces` and additive columns →
  `workspace_panes` and additive columns → setup preferences → agent chat
  config/cache → mobile workspaces/index → recent workspaces.
- `initialize_schema(&Connection)` now holds that order; `init_db()` remains the
  sole production owner of database path/opening and calls it unchanged.
- The legacy fixture verifies the earliest workspace/pane shape upgrades,
  preserves persisted values, adds all currently required columns, creates the
  remaining support tables, and remains idempotent. Existing DB tests cover
  workspace/pane/recent/mobile round trips; agent config/cache table creation
  is asserted by the schema fixture.
- Evidence: DB-focused tests (7), full Rust suite (264 passed, 2 live CLI
  tests ignored), `cargo fmt --all -- --check`, `cargo check --all-targets
  --locked`, `cargo clippy --all-targets --locked -- -D warnings`, and
  `git diff --check` pass.

## Phase 6 — Agent runtime concurrency and subscriber policy

**Files:** `src-tauri/src/modules/agent_chat/runtime.rs`, `daemon.rs`, `event_sink.rs`, `session_commands.rs`, frontend runtime tests.

- [x] Add deterministic concurrent-start tests for two requests with the same `chatId` and two requests with different `chatId`s.
- [x] Keep the current global start gate until tests prove whether per-chat gates can preserve one-provider-per-chat without duplicating spawn/remember behavior.
- [x] Decide explicitly whether one current UI channel is the product contract; only introduce a subscriber registry if multiple simultaneous views are required.
- [x] Test stale channel cleanup, replay ordering, detach-without-kill, explicit close, idle reaping, runtime counters, and overlapping attach delivery.
- [x] Add deterministic provider-exit cleanup through a narrow launch-to-runtime ownership seam, preserving all existing command names and serialized payloads.
- [ ] Measure cold-start and warm-attach latency before changing process residency or introducing a sidecar daemon.

Exit proof: concurrency behavior is specified by tests, not inferred from mutex placement; any lock narrowing has a measured and reviewable tradeoff.

### Phase 6 measurement instrumentation — 2026-08-31

- The existing deterministic tests cover same-chat admission, distinct-chat
  admission, replay ordering, stale channel cleanup, detach-without-kill,
  explicit close, and idle reaping. The one-current-channel contract remains
  intentional; no subscriber registry was introduced.
- `agent_chat_runtime_status` now exposes nullable `lastColdStartMs` and
  `lastWarmAttachMs`. `agent_chat_start` records its wall-clock duration after
  a successful command path; a poisoned telemetry lock is intentionally
  ignored so observability cannot turn a successful provider lifecycle into a
  failure.
- The status fields are instrumentation, not a benchmark result. Actual
  provider CLI measurements remain required before changing the global start
  gate, residency, or process topology.
- Evidence: direct runtime-status metric test, full Rust suite (265 passed, 2
  live CLI tests ignored), `cargo check`, Clippy, full frontend suite (1,122
  tests + 6 relay), production build, and `git diff --check` pass.

### Phase 6 admission-policy decision — 2026-08-31

- The current `useAgentChatSession` contract attempts a background resident
  attach when an active chat mounts. A successful attach is projected into the
  timeline; a missing resident runtime is intentionally silent.
- A cold provider process starts only during first-prompt admission. The
  `agentChatStartup` model coalesces concurrent attach/start requests for the
  same chat, and the submit path sends the prompt after a warm attach but lets
  a cold start carry the initial prompt itself.
- This makes the resource boundary explicit: mounting may resume an existing
  runtime but never launches a new provider without user input. The direct
  startup tests cover cold admission, warm reuse, failed attach fallback, and
  cold-start retry.

### Phase 6 observer attach race hardening — 2026-08-31

- `AgentChatEventSink` now snapshots its test hook before invoking it and
  refuses to deliver a replay batch once its generation is superseded. This
  preserves replay-before-live ordering for the current channel without
  holding an internal mutex while invoking callbacks.
- The overlap regression test proves a stalled first attach neither deadlocks
  a second attach nor delivers the first snapshot into the second channel.
- Evidence: event-sink focused tests plus full Rust suite (272 passed, 2 live
  CLI tests ignored), `cargo fmt --all -- --check`, `cargo check`, Clippy, and
  `git diff --check` pass.
### Attachment-token detach migration — 2026-09-01

**Status:** implemented after explicit approval.

**Observed race:** `agent_chat_attach` replaces the sink channel and returns
only `sessionId`, while unmount cleanup later calls `agent_chat_detach(chatId)`.
If a newer view attaches first, the older cleanup detaches the newer view's
channel. The runtime has no attachment identity to compare at
`session_commands.rs:70-91`, `runtime.rs:220-236`, `runtime.rs:311-317`, or
`event_sink.rs:39-52`.

**Implemented interface:**

- `AgentChatStartResult` from `agent_chat_start` and `agent_chat_attach` now
  returns opaque `attachmentToken` alongside `sessionId` in camel case.
- `agent_chat_detach` accepts optional `sessionId` and `attachmentToken`. A
  missing or non-matching pair is a safe no-op; the current frontend sends the
  triple `chatId`, `sessionId`, and `attachmentToken`.
- Keep the token in the event-sink lifecycle only. It must not be persisted in
  SQLite, timeline state, or durable `chatId` mapping. A successful attach
  advances the sink generation; detach clears the channel and marks the daemon
  idle only when both the current durable session id and generation match.
- The hook keeps the attachment pair in a ref solely for unmount cleanup,
  replaces it after attach/start/recovery, and clears it before explicit close
  or branch rewrite. It must not reuse a token across a different runtime
  session. A branch rewrite also clears its startup cache before replacing the
  runtime epoch, so new provider events are bound to the new Channel.

**Why this option:** it preserves one-current-channel semantics and command
names, makes stale cleanup idempotent, and reuses the event sink's existing
generation owner. A new `detach_v2` command would preserve an unsafe legacy
path; a process-global random token would duplicate the sink's lifecycle
source of truth.

**Proof:** Event-sink tests prove an old token cannot detach a newer channel
and matching token detaches once without changing replay/live ordering. Runtime
tests prove missing legacy payload, wrong session id, and stale token are
no-ops; the current triple marks the runtime detached without killing it. The
start result serializes `attachmentToken`, startup/hook tests retain the pair
only for cleanup, and the Tauri static payload fixture accepts the new optional
detach keys. Focused and full frontend/Rust gates pass below.

### Phase 6 provider-exit cleanup — 2026-08-31

- `AgentChatRuntime::handle_provider_exit` now separates a persistent
  Codex/OMP EOF from a per-turn Claude/Print completion. Persistent exits
  remove the resident runtime and durable `chatId` mapping without issuing a
  second kill/wait; per-turn exits retain their resident runtime.
- Admission and cleanup share the runtime owner, and stale durable mappings
  self-heal before a new attach/start decision. An attached UI that receives
  the existing unknown-session send failure clears its cached id, re-admits,
  and retries the prompt exactly once through the existing deduplicated start
  path.
- Evidence: Agent Chat Rust tests (55 passed, 2 live CLI tests ignored),
  focused frontend tests (14), independent review, and the final full gate
  below. No `agent_chat_*` wire name or serialized payload changed.

### Phase 1 remote shell lifecycle test hardening — 2026-08-31

- Remote WebSocket lifecycle coverage no longer asserts a user-shell-specific
  prompt control sequence. It attaches, writes a marker command, and asserts
  the echoed output instead—the actual stable protocol contract.
- The focused lifecycle test passed four consecutive runs after the change;
  the full Rust suite passes without the previous prompt-timing failure.

### Phase 1 remote bootstrap URL behavior slice — 2026-08-31

- `remoteBootstrapUrl` owns Android-safe setup-path decoding, query/hash
  fallback precedence, and one-time-secret scrubbing while preserving unrelated
  URL parameters. `RemotePasswordScreen` retains browser history and password
  form ownership.
- Direct tests cover path precedence, malformed path fallback, and scrubbed
  URL rendering; the Remote UI source contract protects screen delegation.
- Evidence: focused Remote tests, full frontend/relay suite (1,163 + 6),
  production build, and `git diff --check` pass.

### Phase 1 remote folder picker view-model slice — 2026-08-31

- `remoteFolderPickerModel` owns normalized local search, folder/file view
  filtering, and empty-view state. `RemoteFolderPicker` retains fetch,
  authorization, cache, AbortController, navigation, and selection ownership.
- Direct tests cover trimmed/case-insensitive filtering, empty query, unmatched
  search, and missing folder state; the source contract now checks model
  delegation rather than the DTO declaration's previous file location.
- Evidence: focused Remote tests, full frontend/relay suite (1,166 + 6),
  production build, and `git diff --check` pass.

## Phase 7 — Platform validation

**Files:** `src-tauri/src/modules/speech.rs`, `speech_macos_*`, `speech_windows.rs`, `src-tauri/src/modules/pty/shell_init.rs`, `shell_init_unix.rs`, CI/runbook docs.

- [x] Keep macOS audio-engine callback/lifecycle extraction behind main-thread lifecycle tests and the existing event contract.
- [ ] Audit Windows/WSL shell builder boundaries with an actual Windows target compile and shell smoke test; do not infer Windows behavior from macOS/Linux.
- [x] Record the exact target/toolchain prerequisites and known unavailable environments in the platform validation documentation.
- [x] Run host checks plus target-specific checks available in CI or a native workstation.

Exit proof: platform-sensitive changes have target evidence or an explicit, dated gap; no host-only pass is reported as cross-platform proof.

### Phase 7 platform inventory — 2026-08-31

- Host evidence: macOS 26.1 arm64, Xcode at
  `/Applications/Xcode.app/Contents/Developer`, Cargo 1.97.1; host-target
  `cargo check --all-targets --locked` and Rust tests pass.
- Installed targets include `x86_64-pc-windows-msvc`, but attempting
  `cargo check --target x86_64-pc-windows-msvc --all-targets --locked` fails
  in the `ring` C build because the macOS compiler has no Windows SDK headers
  (`assert.h`). This is a cross-toolchain prerequisite gap, not project Rust
  evidence or a code failure.
- Required Windows evidence: run that command from a Windows/MSVC Developer
  environment with the Windows SDK, then perform the WSL shell smoke test and
  desktop-blur interaction check there. Required macOS evidence remains a
  bundled-app microphone/audio-engine lifecycle smoke test. The repeatable
  checklists live in `docs/WINDOWS_TESTING.md` and
  `docs/MACOS_SPEECH_TESTING.md`; they are instructions for collecting target
  evidence, not claims that target evidence has already been collected.

### Phase 7 macOS lifecycle extraction — 2026-08-31

- `SpeechLifecycle<SpeechSession>` is now the sole main-thread owner of the
  current request generation and active native session. The speech adapter
  keeps AVFoundation/Speech callbacks, permission prompts, and event emission
  in `speech.rs`; it delegates start, invalidation, activation, finish lookup,
  and completion cleanup through `speech_macos_state.rs`.
- A stale recognition result cannot remove a newer session or emit a second
  `cmdspace:speech-stopped` event. Its buffered level, result, and error
  callbacks are rechecked on the main thread before they can publish; stale
  callbacks still release their own old session. A stale post-start session is
  disposed instead of becoming active.
- Evidence: direct lifecycle tests, main-thread invalidation coverage,
  independent review, and the final full Rust suite below. The bundled-app
  microphone smoke test remains a separate manual validation gap.

### Phase 7 Windows speech event fencing — 2026-08-31

- Windows speech stdout now checks the active session id before publishing
  buffered level/result/error events, and EOF no-speech/stopped completion
  uses that same session owner. A host-neutral lifecycle model proves that a
  replaced child cannot publish or clear the replacement session.
- Evidence: three lifecycle tests plus the final full Rust gate below. A real
  Windows/MSVC compile and runtime smoke test remains required; macOS cannot
  compile `ring`'s Windows C dependency without the Windows SDK/MSVC headers.

## Phase 8 — Integration and completion

- [x] Re-run the full gate sequence after each coherent group:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
cd src-tauri && cargo fmt --all -- --check
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
git diff --check
```

Latest shared-worktree evidence (2026-09-01): `pnpm exec tsc --noEmit`,
`pnpm test` (456 frontend files / 1,178 tests plus 6 relay tests), `pnpm build`,
`cargo fmt --all -- --check`, `cargo check --all-targets --locked`,
`cargo clippy --all-targets --locked -- -D warnings`, `cargo test --all-targets
--locked` (287 passed, 2 ignored live CLI tests), and `git diff --check` pass.

- The frontend CI job now runs `pnpm test` between type-check and production
  build, so the full Vitest/relay suite is a required pull-request and main
  branch gate rather than a local-only check.

### Phase 4 import dialog view-model deepening — 2026-08-31

- `ImportSessionDialog` now delegates derived provider fallback, visible-session
  projection, selected-session projection, and stable provider/session key
  formatting to `src/modules/workspaces/lib/importSessionDialogModel.ts`.
- The dialog still owns open/load/reset lifecycle, native `list_agent_sessions`
  fetching, and import side effects. No extra dialog store or duplicate fetch
  layer was introduced. When a selected provider is disabled, a passive
  component effect normalizes the controller state to `all`, not only the
  rendered fallback; it cannot resurrect when the provider is enabled later.
- Evidence: direct model tests, source contract, a host-neutral
  render/commit/flush/rerender lifecycle regression test, and the final full
  frontend gate below.

### Phase 4 directory response fencing — 2026-08-31

- `DirectoryRequestTracker` is a pure internal State module for
  `useFileTree`: it accepts a directory-read request, invalidates it when the
  same directory is read again, and invalidates every outstanding request when
  the tree root resets. It deliberately has no I/O port or public hook API.
- `useFileTree` remains the lifecycle owner for React state, preferences,
  Tauri `fs_read_dir`, and mutation refreshes. It now publishes a loaded/error
  result only while the tracker says that request is current, so a stale
  response cannot overwrite a newer refresh or a different workspace tree.
- Evidence: direct same-path/reset/independent-path tracker tests, a narrow
  ownership source contract, `pnpm exec tsc --noEmit`, full frontend/relay
  suite (456 files / 1,178 tests + 6 relay), production build, and
  `git diff --check` pass.

- [ ] Review all changed/untracked files against the ownership map before staging.
- [ ] Create separate conventional commits for contract proof, voice/window/explorer seams, persistence, Agent Chat concurrency, and platform validation; do not mix `.commandcode/settings.json` or unrelated feature work.
- [x] Update `docs/REFACTOR_ROADMAP.md` and any ADRs with verified outcomes only.
- [ ] Move this plan to `docs/plans/completed/` only after every acceptance criterion is evidenced.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A refactor remounts a PTY or moves ownership | Preserve React keys and existing owner; add lifecycle tests before moving JSX/effects |
| Native platform extraction breaks unsupported targets | Keep `cfg`-specific modules and compile each target in its own gate |
| Per-chat locking reintroduces duplicate providers | Keep global gate until concurrent-start tests prove the narrower lock |
| Migration changes durable data unexpectedly | Fixture-based upgrade tests, additive migrations, explicit recovery notes |
| More source wrappers reduce clarity | Require a complete policy cluster and direct tests for every new seam |
| Multi-agent staging mixes unrelated work | Ownership map, change-group inventory, and pre-stage diff review |

## Decision record

**Decision:** Treat scale hardening as a staged architecture program, beginning with behavior/contract proof and remaining lifecycle-heavy seams, while preserving current ownership boundaries.

**Drivers:** Feature growth across terminal/AI/remote surfaces, multi-agent refactor concurrency, native platform risk, and current manual contract/migration boundaries.

**Alternatives considered:** Continue splitting by LOC; rejected because the current coordinators are intentional owners and shallow wrappers increase coupling. Replace the desktop architecture with a service/horizontal backend; rejected because remote access is embedded desktop functionality, not a server product. Narrow Agent Chat locking immediately; rejected until concurrency tests and measurements establish safe per-chat semantics.

**Consequences:** More behavior fixtures and explicit contracts are added before broad extraction; some large files remain intentionally stable; platform work depends on native validation.

**Follow-ups:** After this plan is approved for execution, agents should claim one change group at a time and report the owning seam, invariant, focused proof, and integration status.
