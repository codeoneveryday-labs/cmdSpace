# Orchestration Contributor Guide

How Canvas runs coordinate CLI workers. Architecture maps live in `COMPREHENSIVE_PLAN.md`; this file owns only orchestration semantics.

## Run lifecycle

1. Boss (orchestrator CLI in a Canvas terminal) proposes a graph; the panel parses tagged JSON into a manifest draft.
2. User edits and approves an **exact revision** (`expected_revision` — stale approvals rejected).
3. Workers start: max **3 concurrent tasks, 1 task per agent**, respecting `depends_on`.
4. Writable tasks run in dedicated worktrees (`~/.cmdspace/worktrees`); results land on an internal integration branch for review. Nothing auto-merges, nothing auto-deletes.
5. Restart marks active work `interrupted`; resume re-queues **and re-admits** (both halves required — admitting is what restarts workers).

## Backend modules (`src-tauri/src/modules/orchestration/`)

| Module | Owns |
|---|---|
| `mod.rs` | Manifest validation, scheduler (`admit_ready_tasks`), run/task state machine, `OrchestrationRuntime` |
| `commands.rs` | `orchestration_*` IPC surface; resume/retry must admit after re-queue |
| `worktree.rs` | Task worktrees + integration branch; prepare is idempotent |
| `mailbox.rs` / `router.rs` | Per-agent `inbox/outbox/.done`, FIPA-lite acts (**only request/query/propose obligate replies**), hop cap 8, atomic writes |
| `wake.rs` | Wake policy (idle 12s, boot 35s, cooldown 60s, HITL 5min); orchestrator never nudged |
| `launch.rs` | Provider-agnostic launch resolution (tokenize → bin+argv, auto-flag, `--model`); flags come from the caller, never a Rust table |
| `protocol.rs` | Identity renderer (assignment, worktree, mailbox paths; Boss roster+policy) |
| `memory.rs` | FTS5 recall over `memory.md` + `board.md`; explicit reindex command, no auto-trigger |
| `hive_files.rs` | Auto-sync bundle on every persist (`PROTOCOL.md`, `registry.json`, `tasks.json`, `board.md`, identities, `memory.md` scaffolding) |

Mail delivery is automatic on send and on inbox read; the explicit route command stays for direct file writers. Events reuse `TaskActivity` so existing Canvas observers keep working.

## Frontend boundaries

- `cliAgents.ts` catalog is the single source of truth (launch lines, policies, transports). Worker start (spawning) belongs to the panel layer.
- Boss terminal is the single interaction surface — no second chat surface in Canvas UI.
- Orchestrator/worker/mail types mirror the Rust camelCase shapes; keep them in sync by hand.
