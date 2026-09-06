# Execution Plan: Orchestration Mailbox + Router

Date: 2026-09-06

## Status

Active

## Outcome

CLI agents on an Orchestration Canvas run can message each other (and the Boss/orchestrator) through a file-based hive mailbox: per-agent `outbox/` → router → per-agent `inbox/`, with idempotent delivery, hop-cap anti-livelock, and atomic writes. Rust-only; no UI changes.

## Context

- MVP plan: `docs/plans/active/2026-09-05-canvas-orchestration-mvp.md` (Phase 4/5 follow-ups; worker traffic currently routes through the orchestrator, peer messaging deferred).
- Pattern seams (same file): State + Command (Rust owns transitions), Observer (event attach/replay). This work adds a Mailbox/Router mechanism under the same seams — no new pattern.
- Source design: munder-difflin `HIVE.md` (single-writer-per-file, single-committer, FIPA-lite `act` + `hops`, Stop-hook drain, `WorkerWakeWatchdog`). Only the mailbox + router slice is copied here; wake watchdog, memory palace, and circuit breaker stay follow-ups.
- Code: `src-tauri/src/modules/orchestration/{mod,commands,worktree}.rs`, registration in `src-tauri/src/commands.rs`.

## Scope

In scope:

- `mailbox.rs`: `HiveMessage` schema (FIPA-lite subset), roster validation against the run manifest (+ reserved `orchestrator`, `broadcast`), on-disk layout, atomic write, cursor.
- `router.rs`: pure delivery planning (outbox scan → inbox actions), terminal-act rule, hop cap, idempotency.
- 4 additive Tauri commands: `orchestration_mail_send`, `orchestration_mail_inbox`, `orchestration_mail_ack`, `orchestration_mail_route`. Mail notifications reuse the existing `TaskActivity` event (no enum change, no frontend breakage).
- In-module Rust unit tests, test-first where practical.

Out of scope:

- Any `src/` frontend change (UI is declared done).
- Stop-hook drain, wake watchdog/nudge, memory/blackboard, circuit breaker, budgets (follow-ups).
- New managed Tauri state (router is stateless; mailbox is filesystem-scoped per run).
- Git commits of mailbox content (mailbox lives under `~/.cmdspace/orchestration/<run_id>/`, outside any repo — the index.lock problem is avoided by location, not by locking).

## Approach

1. Implement `mailbox.rs` (schema + validation + paths + atomic write + cursor) with unit tests.
2. Implement `router.rs` (pure `plan_delivery`) with unit tests.
3. Wire 4 commands in `commands.rs`, register in `src-tauri/src/commands.rs`.
4. Verify: `cargo test --locked orchestration`, `cargo fmt --all -- --check`, `cargo check --all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`, `git diff --check`.

## Risks And Recovery

- Collision with agents editing `commands.rs` / `src-tauri/src/commands.rs`: additions are append-only blocks; on conflict keep both sides, re-run checks.
- Rollback: new files + additive registration only; delete `mailbox.rs`/`router.rs`, revert the two registration hunks. Mailbox data under `~/.cmdspace` is outside the repo and never auto-deleted.
- Path traversal via crafted ids: all segments pass through `safe_segment`-style sanitization; mailbox root is derived from the snapped run id, never from raw user paths.

## Progress

- [x] Survey seams and contracts.
- [x] `mailbox.rs` + tests.
- [x] `router.rs` + tests.
- [x] Command wiring + registration.
- [x] Full verification.
- [x] `wake.rs` watchdog policy + runtime ownership + IPC surface + tests.
- [ ] Live wiring: PTY last-output timestamps, agent-to-PTY binding, periodic beat (needs PTY-subsystem coordination).
- [x] `launch.rs` provider-agnostic launch resolution + `orchestration_resolve_launch` + tests.
- [x] Fix resume/retry scheduler stall (admit after re-queue) + runtime sequence tests.

## Decisions

- 2026-09-06: Mailbox root is `~/.cmdspace/orchestration/<run_id>/agents/<agent_id>/{inbox,inbox/.done,outbox,cursor.json}` — mirrors munder-difflin `hive/` layout, scoped per run. `dirs::home_dir()` precedent already exists in `worktree.rs`.
- 2026-09-06: `MAX_HOPS = 8`; only `request`/`query`/`propose` obligate a reply; `inform`/`done`/`agree`/`refuse` are terminal.
- 2026-09-06: Message ids are server-generated (`<millis>-<counter>`, time-sortable); body cap 64 KiB.
- 2026-09-06: No new `OrchestrationEventType`; mail delivery/ack emits `TaskActivity` with a `mail` payload so existing Canvas observers keep working.

## Validation

- Focused proof: `cargo test --locked orchestration` (mailbox + router + existing scheduler tests green).
- Repository-required checks: `cargo fmt --all -- --check`, `cargo check --all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`, `git diff --check`.
- Integration or end-to-end proof: deferred (needs live CLI agents; packaged smoke stays a Phase 5 follow-up).

## Result

Implemented 2026-09-06. New files `src-tauri/src/modules/orchestration/mailbox.rs` (HiveMessage FIPA-lite schema, roster validation, atomic outbox write, ack-to-.done + cursor) and `router.rs` (pure `plan_delivery`: direct + broadcast fan-out, hop cap 8, idempotent re-route skip). 4 additive commands (`orchestration_mail_send/inbox/ack/route`) registered in `src-tauri/src/commands.rs`; mail notifications reuse `TaskActivity` so Canvas observers keep working untouched. Verified: `cargo test --locked orchestration` 21/21, `cargo clippy --all-targets --locked -- -D warnings` clean, `cargo fmt --all -- --check` clean, `git diff --check` clean. No frontend, DB migration, or managed-state changes. Follow-ups: Stop-hook drain, wake watchdog, memory/blackboard, circuit breaker.

### Wake watchdog slice (same day)

Added `orchestration/wake.rs`: `WakeWatchdog` pure policy (idle 12s, boot grace 35s, cooldown 60s, HITL rearm 5min, orchestrator never nudged), `classify_hook`, fixed `WAKE_NUDGE` text, `WakeCandidate { agent_id, nudge }` decision output. State lives on `OrchestrationRuntime` (`wake_note_spawn/note_hook/forget/decide`, decide validates the run via snapshot); 4 additive commands (`orchestration_wake_note_spawn/note_hook/decide/forget`). Verified: 28/28 orchestration tests, clippy/fmt/diff clean. Deliberately NOT wired live: `Session` has no last-output timestamp and Rust has no agent-to-PTY binding yet (binding lives on frontend canvas nodes) — both need PTY-subsystem coordination. Note: concurrent agents extended `OrchestrationProvider` (Gemini/OpenCode/Omp) mid-work; `roster()` derives from manifest agent ids so it is provider-agnostic and unaffected.

### Launch resolution slice (same day)

Coordination first: the other agents shipped `docs/plans/active/2026-09-06-orchestration-all-cli.md` mid-work — `OrchestrationProvider` is now `pub type String`, FE `cliAgents.ts` catalog is the single source of truth (47 CLIs, `launch`/`launchPolicy`/`chatTransport` per def), and "launch resolution stays at worker start" (their active area: `startReadyTasks` + manual-worker branch). They also repaired my `mailbox.rs`/`mod.rs` tests through their String migration — no breakage. So `orchestration/launch.rs` is provider-AGNOSTIC by design, no parallel provider table: quote-aware `split_command`, token-exact `has_flag_stance` (substring trap documented), `with_model` injection, `build_worker_launch` (auto-flag append only without stance, whole-line-never-as-binary). One additive command `orchestration_resolve_launch` resolves without spawning; worker start stays the only spawner and stays theirs. Verified: 34/34 orchestration tests, clippy/fmt/diff clean.

### Resume/retry scheduler-stall fix (same day, joint work)

Reviewing the other agents' panel diff surfaced a stall bigger than first suspected: `admit_ready_tasks` ran only inside approve/complete, so `orchestration_resume` left every task Queued (run Running, zero workers start — hits structured AND manual workers after any restart) and `orchestration_retry_task` did the same while also recording a `TaskStarted` event for a task that never started. Their panel already calls `startReadyTasks` after resume/retry, i.e. it was written against the fixed behavior. Correction to the earlier review note: `prepare_task_worktree` IS idempotent (`if !task_path.exists()`), so re-prepare on reattach is safe — the missing piece was purely the admit. Fix: mirror the approve/complete admit+`TaskStarted` block inside both commands (same file's established pattern, no FE changes needed). Added runtime sequence tests (`resume_sequence_readmits_interrupted_tasks`, `retry_sequence_readmits_the_failed_task`) proving the exact composition through public runtime APIs; command bodies mirror the proven shape line-for-line. Verified: 36/36 orchestration tests, clippy/fmt/diff clean. Left for them: inbox initial load on attach, mailbox-composer scope question.
