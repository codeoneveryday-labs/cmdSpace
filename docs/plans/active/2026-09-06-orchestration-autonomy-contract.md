# Execution Plan: Orchestration Autonomy Contract (two-agent coordination)

Date: 2026-09-06

## Status

Active — contract frozen, implementation in progress.

## Outcome

Two agents implement munder-style autonomy on Terax without file conflicts.
Phase order: stop-hook drain → god-agent → memory graph → worker finalize
(breaker/cost merged into finalize). Triggers deferred.

Parent plan: `2026-09-06-orchestration-mailbox-router.md` (mailbox + router +
wake watchdog + launch resolution done; stop-hook drain, memory/blackboard,
circuit breaker explicitly listed as follow-ups — this plan executes them).

## Contract (frozen — no edits without both agents)

```rust
// New file src-tauri/src/modules/orchestration/hook_drain.rs (backend owner creates)
pub enum HookKind { Stop, Notification }
pub struct HookEvent { pub run_id: String, pub agent_id: String, pub kind: HookKind, pub message: Option<String> }
pub enum DrainDecision { AllowStop, BlockWithNudge { nudge: String }, RouteThenBlock { delivered: u32 } }
// Rule: Stop + inbox_count > 0 → RouteThenBlock / BlockWithNudge; orchestrator never blocked; Notification passthrough.
// New file src-tauri/src/modules/orchestration/breaker.rs (other agent creates, pure, no side effects)
pub enum BreakerLevel { Healthy, Steering, Constrained, Stopped }
pub struct BreakerDecision { pub level: BreakerLevel, pub action: BreakerAction, pub changed: bool, pub reason: String }
// Rule: one level per tick, ceiling Constrained unless hardStop = true;
// trip order loop → errorStorm → tokenCap → costCap → velocity / noProgress.
```

Munder reference facts (interface only, not ported): `HookPayload
{hook_event_name, agent_id, session_id, tool_name, stop_hook_active,
message, ...}` → outbound `HookEvent {agentId, event, tool, blocked}`;
breaker `healthy → steering → constrained → stopped`, `hardStop = false`
default; launch `buildWorkerLaunch {bin, args, command}` with per-provider
auto flags.

## Ownership (no crossing until phase merge)

- Backend (this lane): `wake.rs` (Stop arm in `classify_hook`, feed
  `DrainDecision`), new `hook_drain.rs`, `mod.rs` (register mod +
  `handle_stop_hook`), `commands.rs` (new `orchestration_hook_drain` reusing
  `deliver_pending_mail`), `protocol.rs` (god-agent adjudication prompt:
  route, hop-cap 8 ping-pong adjudication, escalate `critical` only). Do NOT
  touch `MemoryGraphPanel.tsx`, `breaker.rs`, `worktree.rs`, `launch.rs`,
  `cliAgents.ts`.
- Other agent (parallel): new `MemoryGraphPanel`-adjacent frontend lib (reads
  existing runtime only, zero new Tauri commands), new `breaker.rs` (pure
  policy + unit tests), `worktree.rs` finalize (`preserve-if-unintegrated`) +
  `launch.rs` / `cliAgents.ts` provider-flag extensions. Does NOT touch
  `wake.rs`, `mailbox.rs`, `router.rs`, `hook_drain.rs`, `protocol.rs`.

Observed 2026-09-06: other agent created
`src/modules/architecture/lib/orchestrationMemoryGraph(.test).ts` and
`orchestrationWorkerLaunch(.test).ts` — frontend-only, no conflict with this
lane.

## Progress

- [x] Contract frozen here.
- [x] `hook_drain.rs` pure + tests.
- [x] `wake.rs` Stop arm + `mod.rs::handle_stop_hook` + `orchestration_hook_drain`.
- [x] God-agent identity rules + test.
- [x] fmt + orchestration tests (57 passed) + clippy clean.

## Decisions

- 2026-09-06: `DrainDecision` stays pure and filesystem-free; the runtime
  resolves `inbox_count` via existing `mailbox::unread_ids` and routes via
  existing `deliver_pending_mail` — no new delivery path.
- 2026-09-06: `BreakerDecision` integration is done jointly only after
  stop-hook merges; neither lane implements it twice.

## Validation

- `cargo fmt --all -- --check`, `cargo test orchestration --all-targets
  --locked`, `cargo clippy --all-targets --locked -- -D warnings`, `git
  diff --check`.
- Merge gate: `git status` clean check before touching the other's files;
  never reset / revert another agent's changes.
