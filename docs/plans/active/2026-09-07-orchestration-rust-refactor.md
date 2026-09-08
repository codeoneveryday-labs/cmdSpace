# Canvas Orchestration Rust Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Canvas Orchestration Rust domain and Tauri command adapters into focused modules while preserving command names, serialized data, SQLite persistence, event replay, and lifecycle behavior.

**Architecture:** `mod.rs` remains a public facade over serializable domain models, run state, event delivery, and runtime coordination. `commands.rs` becomes a command facade that re-exports grouped lifecycle, task, attachment, mailbox, hook, and worker commands. Domain state transitions stay independent from Tauri, SQLite, and filesystem side effects.

**Tech Stack:** Rust 2021, Tauri 2 commands/channels, Serde, SQLite via rusqlite, existing orchestration mailbox/worktree/launch modules, Cargo locked checks.

---

## Invariants

- Keep every command name registered by `src-tauri/src/commands.rs`.
- Keep `camelCase` and `snake_case` Serde representations unchanged.
- Keep SQLite schema and persisted `OrchestrationRun`/`OrchestrationEvent` shapes unchanged.
- Keep max task concurrency at 3 and one active task per agent.
- Keep approval revision checks, interruption, resume/retry admission, validation, integration, mailbox, wake, breaker, and event replay semantics unchanged.
- Do not delete files. Preserve existing modules and compatibility re-exports.

## Tasks

### Task 1: Establish and preserve the baseline

- [x] Capture `git status --short` and current LOC for the two target files.
- [x] Run focused orchestration tests, Rust check, fmt, clippy, and `git diff --check`.
- [x] Record baseline: orchestration tests passed before the split; unrelated pre-existing skill files remain outside this change.

Task 1 follow-up coverage: `command_support` now has an integration-style test
that creates a real in-memory SQLite schema, persists a real orchestration run,
records a real runtime event, and reads the event back to verify run identity,
task identity, and JSON payload preservation.

Task 1 is complete. The command registry contract is covered by the frontend
source test and the Rust registration test; persistence/event sequencing is
covered by the in-memory SQLite command-support test. No desktop runtime or
real CLI provider is required for this proof.

### Task 2: Extract serializable domain models and manifest validation

Files:

- Create `src-tauri/src/modules/orchestration/model.rs`.
- Create `src-tauri/src/modules/orchestration/manifest.rs`.
- Modify `src-tauri/src/modules/orchestration/mod.rs`.

Move DTOs, enums, event types, Serde attributes, manifest validation, dependency-cycle detection, and draft execution construction behind the new modules. Keep public methods and re-exports compatible.

Proof:

- Manifest validation tests pass.
- Serialized field names remain unchanged.
- `cargo test --locked orchestration` passes.

Status: complete. The serializable types are now owned by `model.rs`; manifest validation and draft execution construction are owned by `manifest.rs`; `mod.rs` preserves the facade exports.

Task 2 status: complete. In-memory SQLite coverage proves approval/admission,
completion, failure, resume/readmission, and retry/new-attempt persistence,
including event ordering and task result/error preservation.

Task 2 evidence includes six command-support integration tests covering run
creation/event persistence, approval/admission, completion, failure,
interruption/resume, and retry/readmission. The tests use the real runtime and
an in-memory SQLite adapter without requiring a desktop process or provider CLI.

Task 3 is complete. Added dedicated `run_state_contract_tests.rs` and
`runtime_coordination_contract_tests.rs` modules covering pure approval and
scheduler transitions plus runtime wake validation/nudge behavior without
duplicating the existing detailed compatibility tests.

Canvas frontend follow-up is now started with `useCanvasOrchestrationIntegration.ts`:
it owns orchestration worker reconciliation, run lifecycle hookup, and task
status projection, leaving `ArchitectureCanvas.tsx` as the Canvas coordinator.
The integration seam is protected by a source contract test.

The Canvas presentation wiring is now also isolated in
`CanvasOrchestrationPresentation.tsx`, with `buildOrchestrationToolbarControls`
owning the conditional toolbar contract and the presentation module owning mail
overlay composition. `ArchitectureCanvas.tsx` no longer imports or constructs
the mail overlay directly.

### Task 3: Extract run state transitions

Files:

- Create `src-tauri/src/modules/orchestration/run_state.rs`.
- Modify `src-tauri/src/modules/orchestration/mod.rs`.

Move `OrchestrationRun` state transitions and scheduler logic into a domain-only module. It must not import Tauri, SQLite, filesystem, channels, or runtime locks.

Proof:

- Scheduler, dependency blocking, approval, pause/resume, interruption, retry, and cancellation tests pass.
- `cargo clippy --all-targets --locked -- -D warnings` passes.

Latest Task 3 verification: full Rust suite `400 passed, 2 ignored`, focused
frontend orchestration/registry tests `9 passed`, and `pnpm exec tsc --noEmit`
passed. Rust fmt/check/clippy and `git diff --check` passed.

Latest Canvas integration verification: focused frontend suite `10 passed`,
`pnpm exec tsc --noEmit` passed, `pnpm build` passed, and Rust full suite `400
passed, 2 ignored` with check/clippy/fmt clean. Vite retains the existing large
App/CodeMirror chunk warning.

Latest Canvas presentation verification: focused Canvas suite `24 passed`,
`pnpm exec tsc --noEmit` and `pnpm build` passed; Rust orchestration suite
passed `83` tests with check and clippy clean.

### Task 4: Extract event sink and runtime facade

Files:

- Create `src-tauri/src/modules/orchestration/event_sink.rs`.
- Create `src-tauri/src/modules/orchestration/runtime.rs`.
- Create `src-tauri/src/modules/orchestration/runtime_tasks.rs`.
- Create `src-tauri/src/modules/orchestration/runtime_lifecycle.rs`.
- Modify `src-tauri/src/modules/orchestration/mod.rs`.

Move channel attachment, replay buffering, generation-token handling, runtime registry ownership, task operations, and lifecycle operations behind focused internal modules. Keep `OrchestrationRuntime` method names and visibility stable.

Proof:

- Event replay and stale attachment behavior pass.
- Runtime restore and active-run uniqueness pass.
- Task lifecycle tests pass.

Status: partial. The independent event observer/replay implementation now lives in `event_sink.rs`; the `OrchestrationRun` state machine and scheduler now live in `run_state.rs`; wake, breaker, hook, event, and attachment coordination now live in `runtime_coordination.rs`; task and lifecycle runtime mutation now live in `runtime_tasks.rs` and `runtime_lifecycle.rs`. `runtime.rs` retains registry/restore, mutation primitive, and compatibility tests. Lifecycle, task, attachment, mailbox, hooks, and worker Tauri wrappers now live in grouped command modules. Architecture docs and a registration guard now enforce these seams.

### Task 5: Split Tauri command adapters

Files:

- Create `src-tauri/src/modules/orchestration/commands/lifecycle.rs`.
- Create `src-tauri/src/modules/orchestration/commands/tasks.rs`.
- Create `src-tauri/src/modules/orchestration/commands/attachment.rs`.
- Create `src-tauri/src/modules/orchestration/commands/mailbox.rs`.
- Create `src-tauri/src/modules/orchestration/commands/hooks.rs`.
- Create `src-tauri/src/modules/orchestration/commands/worker.rs`.
- Create `src-tauri/src/modules/orchestration/command_support.rs`.
- Modify `src-tauri/src/modules/orchestration/commands.rs`.

Group commands by responsibility. Keep persistence/event helpers single-sourced. Keep `orchestration_complete_task` validation ordering and failure semantics unchanged.

Status: complete for the command-adapter seam. Tauri command registration points
at grouped wrapper modules for all orchestration command families, and the
implementation core is explicitly private `*_impl` code. A physical split of
every implementation body is not required: the wrappers are the stable Command
interface and the core is the shared implementation module.

Current verification after the event-sink split: `cargo check --all-targets --locked`, `cargo test --locked orchestration` (70 passed), `cargo clippy --all-targets --locked -- -D warnings`, `cargo fmt --all`, and `git diff --check` pass.

The shared persistence/event/mail-delivery adapter now lives in `command_support.rs`; command behavior remains in `commands_impl.rs` until Tauri command bodies are moved with their generated command wrappers. Focused Rust checks remain green after this extraction.

The run state machine was extracted into `run_state.rs`; runtime task/lifecycle methods were then moved to `runtime_tasks.rs` and `runtime_lifecycle.rs`. `runtime.rs` is now 806 LOC due to retained compatibility tests; `commands_impl.rs` is 862 LOC. Full Tauri command body migration remains open because generated command wrappers must move with each attribute.

Runtime coordination was extracted into `runtime_coordination.rs` (125 LOC); focused Rust checks remain green.

Current verification after the runtime split: `cargo fmt --all`, `cargo check --all-targets --locked`, `cargo test --locked orchestration` (70 passed), and `cargo clippy --all-targets --locked -- -D warnings` pass.

Latest full verification: `cargo fmt --all`, `cargo check --all-targets --locked`, `cargo test --all-targets --locked` (394 passed, 2 ignored), `cargo clippy --all-targets --locked -- -D warnings`, `git diff --check`, `pnpm exec tsc --noEmit`, and `pnpm build` all pass. The frontend build retains the existing large-chunk warning for App/CodeMirror.

Current runtime file sizes: `runtime.rs` 490 LOC including compatibility tests, `runtime_tasks.rs` 83 LOC, `runtime_lifecycle.rs` 88 LOC, and `runtime_coordination.rs` 127 LOC.

Latest verified state: lifecycle/task/attachment/mailbox/hooks/worker command wrappers are grouped under `commands/`; runtime state, coordination, event sink, manifest, model, and persistence support have separate seams. Rust validation passed with `cargo fmt --all`, `cargo check --all-targets --locked`, `cargo test --locked orchestration` (70 passed), and `cargo clippy --all-targets --locked -- -D warnings`. Frontend validation passed with `pnpm exec tsc --noEmit` and `pnpm build`.

Remaining cleanup: `commands_impl.rs` remains the private `commands::core` implementation module; the historical commented runtime method blocks have now been removed. Compatibility tests remain colocated with the runtime facade because they exercise its public registry/event contract. A physical per-command implementation split was rejected as unnecessary duplication: Rust's generated Tauri command symbols require moving each body and attribute atomically, while the current adapter/core seam already isolates the public interface.

The core implementation entrypoints are now explicitly named `*_impl`, so
`commands::core` is not confused with a Tauri command registration surface.
Grouped `commands/*` modules remain the only modules carrying
`#[tauri::command]` wrappers.

Full Rust validation after the core-module rename passed: 387 tests passed, 2 ignored, `cargo check --all-targets --locked`, and warnings-denied Clippy passed. The frontend `tsc`/Vite build had already passed before this Rust-only cleanup; no frontend files were changed in this pass.

Post-cleanup verification: full Rust suite 388 passed/2 ignored, focused orchestration suite 71 passed, frontend suite 1,356 passed across 497 files, relay suite 6 passed, TypeScript passed, and production build passed.

Latest Rust verification after the runtime cleanup attempt: `cargo fmt --all`, `cargo check --all-targets --locked`, `cargo test --locked orchestration` (71 passed), and `cargo clippy --all-targets --locked -- -D warnings` pass.

Latest verification after the core naming cleanup: `cargo fmt --all`,
`cargo check --all-targets --locked`, `cargo test --all-targets --locked`
(388 passed, 2 ignored), `cargo clippy --all-targets --locked -- -D warnings`,
and `git diff --check` pass.

Latest Task 2 verification: full Rust suite `396 passed, 2 ignored`, focused
frontend orchestration/registry tests `9 passed`, and `pnpm exec tsc --noEmit`
passed.

Canvas frontend follow-up now has typed, behavior-owning seams:
`useCanvasOrchestrationIntegration.ts` owns run, worker, and task-status wiring;
`CanvasOrchestrationPresentation.tsx` owns toolbar/mail presentation;
`CanvasRenderSurface.tsx` owns background, diagram, terminal, and overlay layer
composition; `useCanvasLayerProps.ts` owns their shared prop contract;
`useCanvasPointerCoordination.ts` owns live pointer down/move/end composition;
and `CanvasViewport.tsx` remains only as a compatibility facade.

Latest Canvas follow-up verification: focused Canvas suite `327 passed`, full
frontend suite `502 files / 1362 tests passed`, relay suite `6 passed`,
`pnpm exec tsc --noEmit`, `pnpm build`, Rust full suite `400 passed, 2 ignored`,
Rust fmt/check/clippy, and `git diff --check` all passed.

Proof:

- Root command registration compiles without changes to command names.
- Focused command and orchestration tests pass.
- No new Tauri capability or frontend IPC changes are needed.

### Task 6: Reorganize tests and document the seams

Files:

- Modify or add co-located Rust test modules as needed.
- Modify `CMDSPACE.md`.
- Modify `docs/architecture/design-patterns.md` only if the new seams are durable contracts.

Keep tests close to the domain seam they verify and document the facade/module ownership map.

Proof:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
cd src-tauri && cargo fmt --all -- --check
cd src-tauri && cargo test --all-targets --locked
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
git diff --check
```

## Recovery

Each task is independently revertible at the file level without changing the persisted schema or command contract. Do not delete old files during the refactor. If a split causes an interface regression, restore the facade re-export or keep the implementation in its previous module until the new seam is verified.

## Final acceptance

- `mod.rs` and `commands.rs` are facades rather than god modules.
- Domain state transitions do not depend on native side effects.
- Command groups have one responsibility each.
- Existing command registration, persisted data, event replay, and lifecycle tests pass.
- No files are deleted and no unrelated frontend behavior changes.
