# Refactor Stabilization Plan

**Goal:** Stabilize the current large refactor, restore green verification, and then deepen the highest-risk seams without changing product behavior.

**Architecture:** Preserve the existing React/Tauri Bridge, Rust command Facade, terminal ownership split, and resident Agent Chat runtime. Work in small seam-focused batches, keeping `App.tsx` as the coordinator and keeping live PTY/process handles outside persisted state.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri 2, Rust 2021, portable-pty, SQLite, pnpm.

## Scope and constraints

- Treat the current worktree as user-owned and already in progress; do not reset, clean, or overwrite unrelated edits.
- Do not delete files without explicit permission.
- No new dependencies.
- Preserve command names and payloads in `src-tauri/src/commands.rs`.
- Preserve standard-terminal vs canvas-terminal lifecycle separation.
- Keep durable workspace/chat metadata separate from live PTY/provider processes.

## Requirements summary

1. Restore the frontend and Rust source-contract tests after file decomposition.
2. Validate Agent Chat attach/detach/close semantics and resident-runtime uniqueness.
3. Reduce remaining composition-root complexity only where a real behavior seam exists.
4. Produce reviewable, independently verifiable change groups.

## Acceptance criteria

- `pnpm exec tsc --noEmit` passes.
- `pnpm test -- --run` passes with zero failed test files and zero failed tests.
- `pnpm build` passes.
- `cd src-tauri && cargo check --all-targets --locked` passes.
- `cd src-tauri && cargo clippy --all-targets --locked -- -D warnings` passes, or any existing blocker is documented.
- Source-contract tests inspect the owning implementation files after decomposition rather than relying on stale monolithic paths.
- Agent Chat tests prove: one runtime per durable `chatId`, replay-before-live ordering, detach-without-kill, explicit close cleanup, and stale subscriber removal.
- No persisted workspace/canvas snapshot contains live PTY/process/channel handles.
- Each phase can be reviewed independently from the current dirty worktree.

## Implementation steps

### Phase 0 — Baseline and change inventory

**Files:** read-only inspection of `git status`, `git diff --stat`, `docs/REFACTOR_ROADMAP.md`, and current failing test output.

- [x] Record the current changed-file groups: agent runtime, speech/path decomposition, canvas, terminal, workspace, and generated/untracked additions.
- [x] Confirm whether `src/modules/ai/lib/agentChatHistory.ts` is intentionally removed by the active refactor before any test or import change.
- [x] Run the baseline commands listed in Verification and save the exact failures in the plan.

### Phase 1 — Repair source-contract tests

**Files:**
- Modify: `src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
- Modify: `src-tauri/windows-paths.source.test.ts`
- Inspect: `src-tauri/src/modules/speech.rs`, `src-tauri/src/modules/speech_commands.rs`, `src-tauri/src/modules/speech_windows.rs`, `src-tauri/src/modules/workspace_wsl.rs`, `src-tauri/src/modules/workspace.rs`

- [x] Update speech tests to read the split command/platform files while retaining assertions for command registration and Windows hypothesis/final-result behavior.
- [x] Update Windows path tests to read `workspace_wsl.rs` for drvfs and UNC helpers, while keeping shell lookup assertions against `pty/shell_init.rs`.
- [x] Run only the two affected test files and confirm all four previous failures are gone.
- [x] Run the full frontend/relay test command.

### Phase 2 — Verify and harden Agent Chat residency

**Files:**
- Inspect/modify: `src-tauri/src/modules/agent_chat/runtime.rs`
- Inspect/modify: `src-tauri/src/modules/agent_chat/daemon.rs`
- Inspect/modify: `src-tauri/src/modules/agent_chat/event_sink.rs`
- Inspect/modify: `src-tauri/src/modules/agent_chat/session_commands.rs`
- Inspect/modify: `src/modules/ai/lib/agentChatRuntime.ts`
- Inspect/modify: `src/modules/ai/hooks/useAgentChatSession.ts`
- Tests: `src-tauri/src/modules/agent_chat_test.rs`, resident tests in `runtime.rs`, and `src/modules/ai/hooks/useAgentChatSession.source.test.ts`

- [x] Add or strengthen deterministic tests for detach behavior and stale channel cleanup.
- [x] Add or strengthen deterministic tests for attach replay ordering and explicit close mapping cleanup.
- [x] Serialize the `start` check → spawn → remember sequence with a runtime start gate so concurrent starts cannot duplicate a provider.
- [x] Trace the full identity path: durable `chatId` → daemon mapping → runtime session ID → provider process.
- [x] Confirm React unmount/remount performs detach/attach and does not close or respawn the provider.
- [ ] Keep model/slash discovery off the first active-chat critical path; use cache-first behavior.
- [x] Run targeted Rust and frontend Agent Chat tests before broader validation.

Implementation note: `AgentChatEventSink` now supports an explicit detached state;
events continue accumulating in the bounded replay tail without being delivered to
an unmounted channel. The new regression test is
`detach_stops_delivery_until_a_new_channel_attaches`.

Implementation note: `AgentChatRuntime::start_lock` serializes provider starts
globally. This intentionally favors the no-duplicate-process invariant over
parallel cold starts; a future optimization can replace it with per-chat locks
only after concurrency tests cover the narrower scope.

Phase 2 verification: full frontend/relay tests, targeted Agent Chat Rust tests,
TypeScript check, build, Cargo check, and Clippy all pass after the runtime gate.

### Phase 3 — Stabilize terminal and canvas seams

**Files:**
- Inspect/modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Inspect/modify: `src/modules/terminal/lib/rendererPool.ts`
- Inspect/modify: `src/modules/architecture/CanvasTerminalNode.tsx`
- Inspect/modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Tests: existing terminal/canvas source and model tests

- [x] Verify renderer pool rebinding does not create duplicate PTYs or evict an active leaf over the 12-pane boundary through existing renderer-slot and terminal lifecycle tests.
- [x] Verify canvas camera transforms do not trigger PTY fit/resize on every camera tick through camera and canvas source-contract tests.
- [x] Verify canvas node unmount closes its private PTY and persisted diagrams contain metadata only through canvas terminal lifecycle and persistence tests.
- [x] No additional extraction made: current remaining orchestration did not present a sufficiently deep, independently testable seam for a safe change.

### Phase 4 — Reduce composition-root coupling

**Files:**
- Inspect/modify: `src/app/App.tsx`
- Inspect/modify: `src/app/lib/useWorkspaceController.ts`
- Inspect/modify: `src/modules/workspaces/WorkspacesPanel.tsx`
- Inspect/modify: `src/modules/tabs/lib/useTabs.ts`

- [x] Keep tab/workspace/pane ownership in the existing coordinators.
- [x] Extract pure selectors/transitions before moving side effects; existing extracted models already cover the safe seams.
- [x] Do not split `useTabs` ownership; existing pane-tree transition tests remain the guardrail.
- [ ] Split the remaining workspace setup/import presentation only if a future change exposes a deeper interface; no safe additional extraction was justified in this pass.

### Phase 5 — Reviewable integration and cleanup

- [ ] Group changes into logical commits: test-contract repair, Agent Chat runtime, terminal/canvas, composition roots. (Deferred until the pre-existing dirty worktree is intentionally partitioned.)
- [x] Review `git diff --check`, imports, deleted-file references, and untracked-file intent for this pass.
- [x] Update this plan with verified progress and remaining risks.
- [ ] Move this plan to `docs/plans/completed/` only after the broader dirty worktree is partitioned and reviewed.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Stale source tests hide a real contract regression | Update tests to assert both split implementation and command registration; run full suite. |
| Agent provider process duplication or leak | Centralize lifecycle in daemon/runtime; test start/attach/detach/close and provider exit cleanup. |
| PTY regressions from renderer/canvas refactor | Keep ownership unchanged; run focused model tests plus manual PTY smoke test when available. |
| Dirty worktree contains unrelated user work | Never reset/clean; inventory changes before editing and keep patches narrow. |
| Refactor creates shallow wrapper modules | Require a complete behavior seam and focused tests before extracting. |

## Verification sequence

```bash
pnpm exec tsc --noEmit
pnpm test -- --run
pnpm build
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
```

### Verification evidence (2026-08-31)

- `pnpm exec vitest run src/modules/ai/components/FloatingVoiceAgent.source.test.ts src-tauri/windows-paths.source.test.ts`: 22/22 passed.
- `pnpm test`: 427 test files and 1,091 tests passed; relay suite 6/6 passed.
- `pnpm build`: passed; Vite emitted existing chunk-size warnings for the main app bundle.
- `cd src-tauri && cargo check --all-targets --locked`: passed.
- `cd src-tauri && cargo clippy --all-targets --locked -- -D warnings`: passed.
- `cargo fmt --all -- --check`: reports pre-existing formatting differences in
  `src-tauri/src/modules/agent_chat_live_test.rs`; files changed in this pass
  pass targeted `rustfmt --check`.
- `cd src-tauri && cargo test --all-targets --locked`: 247 passed, 2 ignored.
- Remote WebSocket integration test was reproduced once with a `WouldBlock`
  read and then passed five consecutive targeted runs after bounded retry logic
  was added to the test reader.

Targeted checks should run before the full sequence:

```bash
pnpm exec vitest run src/modules/ai/components/FloatingVoiceAgent.source.test.ts src-tauri/windows-paths.source.test.ts
cd src-tauri && cargo test agent_chat --all-targets --locked
```

## Decision record

**Decision:** Stabilize the existing refactor before introducing additional architectural movement.

**Drivers:** Current worktree scale, four stale source-contract failures, lifecycle sensitivity of PTY/Agent Chat, and the need for independently reviewable diffs.

**Alternatives considered:** Continue extracting `App.tsx`/`ArchitectureCanvas.tsx` immediately; rejected because verification is currently red and ownership boundaries are still being validated. Revert the refactor; rejected because the repository documents the decomposition as intentional and destructive rollback is unauthorized.

**Consequences:** Short-term work focuses on tests and lifecycle proof; deeper decomposition is delayed until the baseline is green.

**Follow-ups:** Measure Agent Chat cold/warm attach latency and resident resource usage before considering an OS-level sidecar daemon.
