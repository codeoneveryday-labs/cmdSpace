# Refactor Partition and Behavior-Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current large refactor into independently reviewable, behavior-proven change groups before further broad extraction.

**Architecture:** Preserve the React ↔ Tauri Bridge, `App.tsx` coordination ownership, standard-versus-canvas terminal split, and resident Agent Chat runtime. Refactor only behind a demonstrated deep seam; prove behavior through direct model, hook, or Rust tests rather than source-string assertions.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Tauri 2, Rust 2021, SQLite, `portable-pty`, pnpm.

---

## Context and boundaries

The 2026-08-31 review observed 739 changed paths in the active worktree (95 modified, 643 untracked, one deleted) while the final current gates passed. This plan adds sequencing and proof discipline; it does not authorize a reset, cleanup, file deletion, dependency addition, or product redesign.

Existing plans remain authoritative for detailed work:

- `docs/plans/active/2026-08-31-refactor-stabilization.md` — stabilization history.
- `docs/plans/active/2026-08-31-architecture-scale-hardening.md` — ownership seams and platform/migration phases.
- `docs/REFACTOR_ROADMAP.md` — product-level refactor map.

## Requirements and acceptance criteria

1. Assign every changed path to one independently testable group before staging.
2. Move changed behavior claims away from source-string assertions, retaining those assertions only for structural invariants.
3. Add executable Agent Chat proof for concurrent admission and lifecycle cleanup before narrowing its lock.
4. Keep `App.tsx` and `ArchitectureCanvas.tsx` stable unless a complete policy seam produces a smaller caller interface.
5. Keep security-policy and performance work separate from cleanup.

A group is ready only when its focused proof, the full gate, and an exact staged-path review pass. No group may include `.commandcode/settings.json` unless it explicitly owns that file.

## Ownership map

| Group | Primary paths | Invariant | Focused proof |
|---|---|---|---|
| Voice lifecycle | `src/modules/ai/hooks/useWhisperRecording.ts`, `src/modules/ai/lib/voiceCapture*`, and the floating-voice contract test | Hook owns React/event cleanup; model owns transitions. | Voice model + hook cleanup test. |
| Command bridge | `src/lib/tauriCommandRegistry.contract.test.ts`, `src-tauri/src/{commands,lib}.rs` | Frontend invoke names/payloads match Tauri registration. | Registry contract test. |
| Agent Chat | `src-tauri/src/modules/agent_chat/`, `src/modules/ai/{components/Agent*,hooks/useAgent*,lib/agent*}` | One runtime per durable `chatId`; detach does not close. | Direct Rust lifecycle tests. |
| Terminal/canvas | `src/modules/terminal/`, `src/modules/architecture/` | Standard pool and private canvas sessions never mix. | Renderer, pane, docking, persistence tests. |
| App/workspace | `src/app/`, `src/modules/workspaces/`, `src/modules/tabs/` | App owns workspace/tab/pane coordination. | Model + App/workspace tests. |
| Frontend feature surfaces | `src/modules/{explorer,git-history,shortcuts,sidebar,source-control}/`, `src/settings/`, `src/tray/` | Each module retains its product-state owner and native bridge use. | Module-focused tests. |
| Native facades | `src-tauri/src/modules/{db,fs,git,net,pty,remote,speech,workspace}/`, `crates/` | Public command and durable-data contracts survive extraction. | Domain Rust tests. |
| Docs/config | `docs/`, `AGENTS.md`, `.commandcode/settings.json` | Evidence is factual; local settings are isolated. | Staged-path review. |

### Task 1 evidence — 2026-08-31 live snapshot

- [x] Classified all 799 changed paths: voice lifecycle 3; command bridge 3; Agent Chat residency 94 (including one intentional deletion); terminal/canvas 239; app/workspace coordination 237; native facades 106; frontend feature surfaces 103; documentation/configuration 11.
- [x] `git diff --check` passed for this snapshot.
- [x] No path remained unassigned after the ownership-map clarifications above.
- [ ] Re-run this manifest immediately before each future staging operation; active parallel work can change the inventory.

## Task 1: Freeze the review boundary

**Files:** This plan and the relevant existing active plan; inspect `git status --short --untracked-files=all`, `git diff --stat`, and `docs/REFACTOR_ROADMAP.md`.

- [x] Record the current path count and assign every changed path to exactly one ownership-map row.
- [ ] Treat an unassigned file as a blocker; do not stage it.
- [ ] Run `git diff --check` before and after each group.
- [ ] Do not start a new extraction while a prior group has a failing focused test or unreviewed untracked file.

**Exit proof:** A reviewer can identify each staged file’s owner, invariant, and test command without reading the whole worktree.

## Task 2: Complete the voice lifecycle vertical slice

**Files:**

- Modify: `src/modules/ai/hooks/useWhisperRecording.ts`
- Modify only for a proven defect: `src/modules/ai/lib/voiceCaptureModel.ts`
- Test: `src/modules/ai/lib/voiceCaptureModel.test.ts` and a direct hook cleanup test.

- [ ] Keep `createVoiceCaptureModel` responsible for `idle → recording → transcribing → idle`, fallback decisions, timer cleanup, and cancellation.
- [ ] Keep `useWhisperRecording` responsible for Tauri event subscriptions, browser capture adapters, React state projection, and unmount disposal.
- [ ] Test native start/confirm/final result; cloud success; empty recording; no-speech; cloud-to-native fallback; remembered cloud failure; cancel; and unmount cleanup.
- [ ] Run:

```bash
pnpm exec vitest run src/modules/ai/lib/voiceCaptureModel.test.ts
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

**Exit proof:** The public hook API remains unchanged, and every stream, recorder, timer, and listener has matching cleanup.

### Agent control first-paint evidence — 2026-08-31

- `useAgentChatControls` now loads only model cache and persisted chat configuration on mount.
- CLI model and slash-option discovery remain on the existing picker/refresh callbacks; absent persisted effort or permission defaults no longer trigger CLI work during first paint.
- Focused controls/workspace contract tests and the TypeScript check pass.

## Task 3: Add Agent Chat concurrency and lifecycle proof

**Files:**

- Modify: `src-tauri/src/modules/agent_chat/runtime.rs`, `daemon.rs`, and `event_sink.rs` only if a narrow internal admission seam is needed.
- Modify: `session_commands.rs` only to route through that seam without changing `agent_chat_*` wire names.
- Test: colocated resident-runtime and event-sink tests.

- [ ] Add a package-private admission helper that keeps durable lookup, provider-creation callback, and mapping creation inside the existing start lock.
- [ ] Use a barrier and atomic spawn counter to prove two simultaneous starts for one `chatId` create one runtime and return the same id.
- [ ] Prove two different `chatId` values receive distinct mappings.
- [ ] Prove replay-before-live ordering, detach-without-kill, explicit close cleanup, idle reaping, and failed-subscriber cleanup.
- [ ] Consolidate duplicate compatibility-facade tests only after explicit written approval for any test-file deletion.
- [ ] Run:

```bash
cd src-tauri && cargo test --locked agent_chat
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
pnpm test
```

**Exit proof:** Concurrent behavior is defined by tests, not inferred from mutex placement.

### Task 3 evidence — 2026-08-31

- `AgentChatRuntime::start_or_attach` now owns the existing global gate, warm attach, cold launch callback, and durable mapping sequence.
- Runtime status exposes the most recent cold-start and warm-attach latencies; direct attaches record warm timing through the shared attach seam.
- Direct tests prove concurrent same-chat starts create one runtime, concurrent different-chat starts create distinct runtimes, a failed delivery detaches its stale channel, and an expired detached runtime is reaped with its durable mapping.
- `cargo test --locked agent_chat`: 46 passed, 2 real-CLI tests intentionally ignored.
- Scoped rustfmt and diff-whitespace checks pass for the Agent Chat files; the full Clippy gate now passes.

## Task 4: Convert the highest-value source contracts

**Files:** Changed `*.source.test.ts` and `*.source.test.tsx` files; direct tests next to the Agent Chat, voice, terminal lifecycle, canvas persistence, and command-bridge seams.

- [ ] Classify each changed string assertion as a structural invariant, wire contract, or behavior claim.
- [ ] Keep string assertions only for command registration, two-process ownership, canvas-versus-standard terminal ownership, and platform guards.
- [ ] For every behavior claim, add or strengthen a direct model, hook, render, or Rust test first.
- [ ] Record the category and replacement test path in `docs/reports/2026-08-31-source-contract-inventory.md`.
- [ ] Retain existing source tests until written approval exists to delete or consolidate them.

**Exit proof:** Moving implementation files does not cause broad test churn, but a real bridge or lifecycle regression still fails.

### Task 4 evidence — 2026-08-31

- The source-contract inventory classifies 275 source-contract files and 2,628 implementation-string assertions.
- The voice lifecycle group now has direct model (8), listener cleanup (3), and browser capture cleanup (3) tests; this is the first behavior-proof migration.
- The Tauri command registry has a dedicated two-test static name/payload contract fixture.
- `canvasTerminalInteractionCommit.test.ts` directly proves terminal-group close removes terminals, connected edges, dock state, active/maximized ids, and transient selection state.
- `architectureDrawingModel.test.ts` directly proves pen-point de-duplication and unsnapped connector geometry generation.
- `architectureConnectorModel.test.ts` directly proves endpoint snapping preserves connector geometry and records the snapped target identity.
- `remoteSessionLifecycleModel.test.ts` directly proves normalized folder-session matching, active-session fallback, and bounded retry-create policy now used by `RemoteApp`.
- `useAgentChatControls` now defers CLI model/slash discovery until picker interaction; persisted config and cache hydration remain the only first-paint work.
- Explorer selection and TreeRow pointer/delete policies now live behind direct-testable transitions rather than only React callbacks.
- `remoteDevicePairingUrl.test.ts` directly proves native deep-link encoding of every remote pairing grant field.
- `rendererSlotLifecycle.test.ts` directly proves standard slot bind/replay/resize, alt-screen ring discard plus PTY repaint, and detach cleanup; the renderer source contract remains for pool, input-path, and CSS/platform ownership invariants.
- `rendererResize.test.ts` directly proves paused chrome resize deferral, resumed terminal fit/refresh/PTY sizing, and repaint without redundant PTY sizing, replacing brittle renderer source assertions.
- `resolveTerminalExitDisposition` now owns terminal exit policy (notify, defer, or suppress during a planned respawn) with direct transition tests, replacing the former inline source assertion.
- `rendererInput.test.ts` now directly proves debounced auto-copy, duplicate suppression, accessible success feedback, cleanup on success, and no cleanup on clipboard failure instead of source-string assertions.
- The renderer input interaction test directly proves OSC 10/11 color metadata is not forwarded as shell input, replacing that branch-level source assertion.
- The renderer input interaction test directly proves prompt observation precedes forwarding Enter to the PTY, replacing the prior source-string ordering check.
- Keymap tests now import the actual pure functions, and the renderer input interaction test directly proves Cmd+Shift+Arrow forwards its line-boundary sequence before pane navigation.
- Canvas terminal selection-copy behavior is covered directly by its copy lifecycle and platform shortcut tests; the Canvas source contract retains isolated-PTY and UI ownership checks.
- Remaining behavior claims are intentionally retained until their direct tests exist; no source test was deleted.

## Task 5: Preserve coordinator depth

**Files:** `src/app/App.tsx`, `src/app/lib/useWorkspaceController.ts`, `src/modules/architecture/ArchitectureCanvas.tsx`, `src/modules/workspaces/WorkspacesPanel.tsx`, and `src/modules/tabs/lib/useTabs.ts`.

- [ ] Before adding a file, record its interface, single owner, cleanup responsibility, and direct test.
- [ ] Reject a wrapper that only forwards props, setters, or one call.
- [ ] Prefer pure transitions/selectors that do not import DOM, PTY, or Tauri effects.
- [ ] Preserve terminal rules: canvas owns private PTY/xterm state; camera movement never resizes PTYs; persistence contains no live handles.

**Exit proof:** Callers receive a smaller interface and lifecycle complexity is hidden; otherwise the code stays with its coordinator.

### Task 5 evidence — 2026-08-31

- `useTabs` is already a deep facade over creation, open, close, and pane-action modules while remaining the tab source of truth.
- `WorkspacesPanel` is a presentation module with local expansion and drag state; workspace persistence stays in `useWorkspaceController`.
- No additional App/workspace extraction was made: current handle registries and cross-surface callbacks would only be redistributed into shallow wrappers.

## Task 6: Gate cross-cutting follow-ups

**Files:** `src-tauri/src/modules/agent_chat/{commands.rs,history.rs}` and production-build output.

- [ ] Treat transcript-to-workspace binding as a separate security decision: current native-history lookup authorizes the requested cwd but searches provider transcript roots by session id.
- [ ] Treat code splitting as a separate measured performance task: the current main App bundle is about 2.23 MB minified / 448 KB gzip.
- [ ] Do not combine either concern with cleanup until policy or a measurement target is documented.

**Exit proof:** Security and performance changes have their own authority, test plan, and measured success criteria.

### Platform validation evidence — 2026-08-31

- Installed targets include `x86_64-pc-windows-msvc`; host cross-check reached `ring` but stopped because this macOS host has no MSVC C toolchain (`VCINSTALLDIR` unset and target compilation cannot find `assert.h`).
- Windows/WSL shell and native speech behavior therefore remain unverified until a Windows MSVC workstation or CI runner runs the target compile and shell smoke test.

## Task 7: Integrate by proven group

- [ ] Run the full gate after each coherent group:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
cd src-tauri && cargo fmt --all -- --check
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
git diff --check
```

- [ ] Review the exact staged paths against the ownership map.
- [ ] Use a conventional Lore-protocol commit message with intent, constraints, alternatives, confidence, scope risk, tests, and known gaps.
- [x] Update `docs/REFACTOR_ROADMAP.md` only with observed results.

**Exit proof:** Each commit is reviewable, reversible, and bisectable without the rest of the dirty worktree.

### Integration evidence — 2026-08-31

- `pnpm test`: 435 frontend test files / 1,122 tests passed; relay suite 6/6 passed.
- `pnpm build`, `cargo check --all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`, `cargo fmt --all -- --check`, and `git diff --check` passed on the latest stable snapshot.
- A subsequent clean `cargo test --locked` run passed 266 tests with 2 real-CLI tests intentionally ignored. An earlier remote prompt timing flake is recorded for follow-up, but did not reproduce in five targeted retries or the clean full run.

### Candidate partitions — not staged — 2026-08-31

The shared worktree remains too large to stage globally. These are exact
review candidates, not commands to stage or commit; re-run the manifest before
any staging operation because other work is still landing.

1. **macOS speech lifecycle** — `src-tauri/src/modules/speech.rs`,
   `speech_commands.rs`, `speech_macos_lifecycle.rs`,
   `speech_macos_state.rs`, `speech_macos_support.rs`, and
   `speech_windows.rs`. Invariant: the main-thread lifecycle state owns the
   active session and request generation; platform adapters retain command and
   AVFoundation/SAPI effects. Proof: speech lifecycle tests, host Rust suite,
   format/check/Clippy. Do not include a bundled-app smoke claim.
2. **standard terminal behavior proof** — `keymap.test.mjs`,
   `rendererInput.ts`, `rendererInput.test.ts`, `rendererPool.source.test.ts`,
   `rendererResize.test.ts`, `rendererSlotLifecycle.test.ts`,
   `terminalSessionRuntime.ts`, `terminalSessionRuntimeModel.ts`,
   `terminalSessionRuntimeModel.test.ts`, and
   `useTerminalSession.boundary.source.test.ts`. Invariant: standard renderer
   pooling remains separate from canvas-owned PTYs. Proof: focused renderer,
   session, and keymap tests plus frontend build.
3. **documentation** follows the owning code group; do not stage this plan,
   the roadmap, or inventory report by themselves.

`src/modules/ai/lib/agentChatHistory.ts` remains a pre-existing deletion outside
these candidates and must not be staged by a partition derived from this plan.

## Risks and decisions

| Risk | Mitigation |
|---|---|
| Broad splitting breaks PTY ownership or persistence | Require an owner, lifecycle proof, and focused test before extraction. |
| Source tests freeze file layout | Add direct proof before any test consolidation. |
| Agent runtimes duplicate | Retain the global lock until concurrency tests pass. |
| A commit captures another worker’s files | Require ownership-map and staged-path review. |
| Security work slips into cleanup | Require a separate policy decision. |

**Decision:** Continue through small, behavior-proven vertical groups, not another repository-wide splitting pass.

**Why:** Existing thin Rust facades are valuable, but the worktree is too large for one review; lifecycle-sensitive areas need direct proof; and shallow wrappers would spread complexity rather than reduce it.

**Rejected:** Further splitting `App.tsx` or `ArchitectureCanvas.tsx` by line count; a one-shot mega-commit; and immediate source-test deletion without explicit authorization and replacement proof.
