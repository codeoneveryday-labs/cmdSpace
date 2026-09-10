# Execution Plan: Maintainability Refactor Feature Goal — 20 Prompts

Date: 2026-09-10

## Status

Active

## Outcome

Execute the next cmdSpace maintainability pass as twenty bounded prompt-sized
vertical slices. The result is a harder Rust/Tauri boundary, better executable
proof, measurable SQLite behavior, and no user-visible changes to terminal,
PTY, workspace, remote, or persistence semantics.

The goal is deliberately incremental: each prompt must leave the tree buildable
and testable, and no later prompt may assume a new abstraction without proof
from an earlier one.

## References and current baseline

- [`2026-09-08-engineering-capability-program.md`](2026-09-08-engineering-capability-program.md)
- [`2026-09-10-maintainability-boundary-hardening.md`](2026-09-10-maintainability-boundary-hardening.md)
- [`docs/architecture/design-patterns.md`](../../architecture/design-patterns.md)
- [`docs/architecture/terminal-input-pipeline.md`](../../architecture/terminal-input-pipeline.md)
- [`docs/WORKFLOW.md`](../../WORKFLOW.md)
- [`CMDSPACE.md`](../../../CMDSPACE.md)

Current merged baseline: `origin/main` at `987078fc6` after PRs #452, #454,
and #456. The prior boundary-hardening plan is mostly complete but remains
active for DB contention measurement and final post-merge re-pinning.

Prompt 01 baseline evidence (2026-09-10):

| Signal | Observed value | Scope / interpretation |
|---|---:|---|
| `HEAD` and `origin/main` | `987078fc6` | tracked tree is aligned with remote main |
| Registered Tauri command entries | 104 | parsed from `cmdspace_commands!` in `src-tauri/src/commands.rs` |
| Frontend files calling `invoke()` | 46 | production/test source search under `src/` |
| Rust `Result<_, String>` lines | 241 | remaining migration surface under `src-tauri/src` |
| Rust test attributes | 283 | `#[test]` and `#[tokio::test]` search under `src-tauri/src` |
| Frontend test files | 441 | `src/` `*.test.ts(x)` files |
| Structural source guards | 247 | `src/` `*.source.test.ts` files |
| IPC contract tests | 1 | `src/` `*.contract.test.ts` files |
| Rough non-test `unwrap`/`expect` hits | 259 | inventory only; requires classification before enforcement |

The tracked tree has no diff against `origin/main`. Two untracked artifacts
remain unstaged and must not be swept into later commits:
`docs/reports/2026-09-09-codebase-review.md` and this feature-goal plan.

Ownership freeze for the remaining prompts:

| Prompt range | Primary owner seam | Required proof |
|---|---|---|
| 02 | `src-tauri/src/modules/db/` | contention/latency report plus DB tests |
| 03–10 | native module command/service boundaries | module tests plus stable error serialization |
| 11–12 | IPC DTOs and command registry | response/error drift contract tests |
| 13–15 | terminal, persistence, remote behavior | executable regression/integration tests |
| 16–17 | Rust lint and existing logging seams | clippy/log redaction proof |
| 18 | DB measurement decision | reproducible go/no-go report |
| 19–20 | repository validation and delivery | full gates, PR, merge, baseline re-pin |

## Scope

In scope:

- Error classification and typed boundary adapters, one feature at a time.
- IPC DTO/response/error contracts for high-value command families.
- Executable behavior tests replacing the highest-risk source-only claims.
- SQLite contention measurement and a documented extraction decision.
- Structured context in existing logs without adding a logging dependency.
- Full verification, baseline re-pin, and delivery through one reviewable PR.

Out of scope:

- A Clean Architecture rewrite or automatic `cmdspace-core` extraction.
- A DB pool/worker before contention measurements justify it.
- Renaming commands, changing serialized payload keys, or changing PTY
  ownership/lifecycle.
- New dependencies unless a prompt records a compatibility decision first.
- Deleting existing files or tests without explicit user authorization.
- Product redesign, provider catalog removal, or security-policy relaxation.

## Global prompt contract

Every prompt in this plan follows the same loop:

1. Read the relevant seam, active plan, and applicable pattern invariant.
2. Write or strengthen an executable regression test before production edits.
3. Make the smallest coherent implementation change.
4. Run focused proof plus the smallest relevant repository check.
5. Commit with Lore trailers; keep the branch reviewable and the diff narrow.

Stop a prompt when its acceptance criteria are met. If proof fails, fix or
revert only that prompt's slice; do not advance the goal by assumption.

## Twenty prompt slices

### Prompt 01 — Re-pin evidence and freeze ownership

**Owner seam:** plan/docs and repository inventory.

**Work:** Measure the current clean `origin/main` baseline: registered command
count, `Result<_, String>` locations, source-guard/executable test taxonomy,
Rust test count, and CI gates. Record the exact SHA and scope in this plan.
Map each later slice to an owner module and pattern invariant.

**Files:** this plan, `docs/reports/`, `.github/workflows/ci.yml`.

**Proof:** inventory commands are reproducible from the pinned SHA; no source
files are changed; unrelated untracked files remain unstaged.

**Status:** complete. The inventory above is the Prompt 01 checkpoint and is
the authoritative starting point for Prompt 02.

### Prompt 02 — Establish the SQLite contention measurement seam

**Owner seam:** `src-tauri/src/modules/db/`.

**Work:** Add a test-only or diagnostic-only measurement harness around the
existing `Mutex<Connection>` path. Measure lock wait and operation latency for
concurrent workspace reads, pane saves, recent-workspace writes, and schema
startup. Do not add a pool or change production scheduling yet.

**Files:** `src-tauri/src/modules/db/tests.rs`, a small measurement helper if
needed, and this plan's validation section.

**Proof:** deterministic single-process stress run reports p50/p95/p99 wait
and operation timings; the normal DB tests remain green.

**Status:** complete. The test-only harness uses four workers and forty
iterations per worker without changing production scheduling. The recorded run
produced 160 samples with lock-wait percentiles of
`42/84/858708 ns` (p50/p95/p99), operation percentiles of
`14541/21542/30250 ns` (p50/p95/p99), and eight schema-startup samples at
`945542/1081834/1081834 ns` (p50/p95/p99). These values are an evidence
baseline, not a cross-machine performance threshold.

### Prompt 03 — Define the native error taxonomy boundary

**Owner seam:** `src-tauri/src/modules/db/error.rs` and the IPC contract.

**Work:** Document the stable error envelope already used by DB (`code` plus
safe message), classify which codes are reusable across modules, and explicitly
reject a premature global error crate if the first cross-module use does not
justify it. Preserve current command names and success payloads.

**Files:** `src-tauri/src/modules/db/error.rs`, `docs/decisions/` only if the
decision is durable, and the plan.

**Proof:** serialization tests cover success, known error codes, and unknown
future codes; no secret/path contents leak through messages.

**Status:** complete. Decision 0012 records the namespaced-code/safe-message
boundary, preserves command/payload compatibility, and rejects a premature
global error crate or generated-binding dependency. Existing DB serialization
tests are the first executable proof.

### Prompt 04 — Migrate one filesystem read vertical slice

**Owner seam:** `src-tauri/src/modules/fs/file.rs` and `file_read.rs`.

**Work:** Introduce a focused filesystem error type for `fs_read_file`, keep
path authorization and binary/too-large discriminants intact, and convert it
once at the Tauri boundary. Do not mechanically migrate every filesystem
command.

**Proof:** tests cover text, binary, too-large, missing, unauthorized, and
invalid-path outcomes; the frontend response shape is unchanged.

### Prompt 05 — Lock the filesystem IPC response/error contract

**Owner seam:** `src/modules/ai/lib/native.ts` and filesystem contract tests.

**Work:** Add a typed adapter for the Prompt 04 response and error envelope.
Ensure callers branch on discriminants/codes rather than matching error prose.
Keep the two-process rule and workspace environment forwarding explicit.

**Proof:** frontend contract tests verify command name, payload keys, response
discriminants, and error-code handling; `tauriCommandRegistry` stays green.

### Prompt 06 — Migrate one shell command vertical slice

**Owner seam:** `src-tauri/src/modules/shell/mod.rs`.

**Work:** Classify `shell_run_command` failures (empty command, unauthorized
cwd, timeout, spawn, output truncation) without changing timeout limits or
process cleanup. Keep one-shot shell execution distinct from PTY sessions.

**Proof:** Rust tests cover each classification and timeout path; existing
frontend `CommandOutput` success behavior is unchanged.

### Prompt 07 — Harden workspace authorization errors

**Owner seam:** `src-tauri/src/modules/workspace_auth.rs` and WSL adapters.

**Work:** Convert one authorization boundary to stable codes for missing cwd,
outside authorized root, symlink escape, invalid WSL distro, and inaccessible
directory. Preserve the security decision and platform-specific path rules.

**Proof:** existing authorization tests plus new code-serialization assertions
prove no unauthorized spawn path is widened.

### Prompt 08 — Classify outbound AI/network errors

**Owner seam:** `src-tauri/src/modules/net.rs`, `net_http.rs`,
`net_security.rs`.

**Work:** Keep SSRF/DNS-rebinding guards as the authority while separating
invalid URL, blocked target, timeout, transport, and upstream status errors.
Do not broaden allowed hosts or expose response bodies containing secrets.

**Proof:** focused tests cover blocked private targets, allowed HTTPS, timeout,
and upstream failure code mapping.

### Prompt 09 — Stabilize a PTY command error seam

**Owner seam:** `src-tauri/src/modules/pty_commands.rs` and `pty_state.rs`.

**Work:** Add a narrow error classification for write/resize/close/list when a
session is absent or a native operation fails. Preserve raw byte streaming,
session ownership, Windows Job Object behavior, and `SPAWN_LOCK` semantics.

**Proof:** Rust tests cover unknown-session and success paths; terminal bridge
contract tests confirm command/payload compatibility.

### Prompt 10 — Harden remote boundary errors

**Owner seam:** `src-tauri/src/modules/remote/` and `remote_auth*`.

**Work:** Choose one remote authentication or device-attachment slice and map
unauthorized, expired grant, revoked device, unavailable runtime, and retryable
transport errors. Keep browser v2 and native device v3 contracts separate.

**Proof:** focused remote tests cover auth rejection, retryable transport, and
capability denial without turning relay outage into authentication failure.

### Prompt 11 — Decide manual versus generated IPC typing

**Owner seam:** existing workspace IPC and command registry contract.

**Work:** Evaluate generated bindings versus the current manual DTO approach.
Record drivers, rejected alternatives, dependency/license/build impact, and a
small candidate family. Do not add Specta or another dependency by default.

**Proof:** an ADR or plan decision names one chosen path, compatibility rules,
and a concrete pilot; no command/payload drift occurs.

### Prompt 12 — Expand IPC contract coverage to a second family

**Owner seam:** `src/lib/tauriCommandRegistry.contract.test.ts` plus the
selected filesystem/shell/workspace bridge.

**Work:** Add response discriminants and stable error-code assertions beside
the existing invoke-name/payload checks. Keep the contract test focused on wire
invariants, not implementation text.

**Proof:** intentional command/payload/error drift fails a focused test; valid
frontend/Rust contracts pass.

### Prompt 13 — Convert terminal/IME structural claims to behavior proof

**Owner seam:** `src/modules/terminal/lib/rendererInput.ts`,
`macImeBridge.ts`, `rendererPool.ts`.

**Work:** Select the highest-risk source-only guards and add executable tests
for direct printable input, focus loss/refocus, C1/NBSP normalization, xterm
duplicate suppression, Enter ordering, and broadcast exclusion of mouse data.
Do not delete old guards in this prompt; narrow only when redundant proof is
demonstrated.

**Proof:** a regression test fails against the old behavior and passes after the
change; standard and canvas terminal ownership remains distinct.

### Prompt 14 — Convert persistence/workspace structural claims

**Owner seam:** `src/app/lib/useWorkspaceHydration.ts`, workspace IPC, and DB
tests.

**Work:** Add executable proof for fresh DB hydration, legacy migration,
unknown future schema rejection, pinned workspace restoration, and pane-layout
round trips. Keep workspace/tab ownership in existing hooks.

**Proof:** Rust + Vitest integration/model tests prove behavior without relying
only on `readFileSync(...).toContain(...)`.

### Prompt 15 — Convert remote/security structural claims

**Owner seam:** `src-tauri/src/modules/remote/`, `src/remote/`, and security
tests.

**Work:** Replace a bounded batch of source assertions with executable tests for
protocol version rejection, auth token handling, device capability denial,
sequence replay handling, and LAN/tunnel fallback. Keep secrets redacted in
logs and fixtures.

**Proof:** remote unit/integration tests exercise parsers/state transitions;
source-guard count does not increase.

### Prompt 16 — Add scoped Rust unwrap/expect enforcement

**Owner seam:** touched native modules only.

**Work:** Inventory non-test `unwrap`/`expect` in the touched slices. Add
scoped clippy policy or replace the highest-risk cases with typed propagation;
do not turn the whole historical codebase red in one prompt.

**Proof:** touched modules pass `cargo clippy -- -D warnings` with the scoped
policy; every remaining exception is documented and bounded.

### Prompt 17 — Add structured context to one existing log boundary

**Owner seam:** DB or remote command boundary, using existing `log` support.

**Work:** Add operation/domain context, outcome, and duration where it improves
diagnosis. Redact paths, tokens, prompt contents, and secrets. Do not add a
new logging dependency or redesign all logging in one pass.

**Proof:** focused tests or log-capture checks prove stable fields and redaction;
manual review confirms no user input is logged raw.

### Prompt 18 — Make the DB extraction decision from measurements

**Owner seam:** DB measurement harness and plan/ADR.

**Work:** Compare Prompt 02 metrics against an explicit threshold agreed in the
plan. If contention is low, document why the mutex remains. If contention is
material, write a separate bounded design for a DB worker/pool; do not implement
the extraction in the same prompt.

**Proof:** reproducible report includes workload, p50/p95/p99, hardware/runtime,
and a go/no-go decision with rejected alternatives.

### Prompt 19 — Final verification and baseline re-pin

**Owner seam:** repository validation and plan state.

**Work:** Run focused tests for all changed slices plus `pnpm exec tsc --noEmit`,
`pnpm test`, `pnpm build`, `cargo check --all-targets --locked`, `cargo test
--all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`,
`cargo fmt --all -- --check`, `pnpm quality:warn`, and `git diff --check`.
Re-measure command/error/test taxonomy from the clean candidate SHA.

**Proof:** all required checks pass, the plan records exact outputs/counts,
and no known error remains hidden behind a claim of completion.

### Prompt 20 — Delivery and closeout

**Owner seam:** issue branch, PR, plan lifecycle.

**Work:** Create one issue/branch per coherent delivery group, use conventional
commits with Lore trailers, open a PR with test evidence and remaining risks,
merge only after CI, update `main`, and move this plan to
`docs/plans/completed/` only when Prompts 18–19 are complete.

**Proof:** merged PR URL, merge SHA, clean `main` fast-forward, updated plan
result, and an explicit list of deferred work.

## Progress

- [x] Prompt 01 — Re-pin evidence and freeze ownership from `origin/main` at
  `987078fc6`; tracked tree clean, inventory recorded, ownership frozen.
- [x] Prompt 02 — Establish the SQLite contention measurement seam; 160-sample
  baseline recorded and DB tests/format/clippy pass.
- [x] Prompt 03 — Define the native error taxonomy boundary in Decision 0012;
  existing DB envelope serialization tests remain green.
- [ ] Prompts 04–10 — Migrate bounded native error slices.
- [ ] Prompts 11–12 — Strengthen IPC response/error contracts.
- [ ] Prompts 13–15 — Convert high-value structural claims to behavior proof.
- [ ] Prompts 16–18 — Enforce scoped quality/logging policy and decide DB extraction.
- [ ] Prompt 19 — Run final verification and re-pin metrics.
- [ ] Prompt 20 — Deliver, merge, re-pull `main`, and close the plan.

## Acceptance criteria

- No new `*.source.test.ts` behavior-only guards are added.
- At least three native families have stable error classification, while
  untouched families remain behavior-compatible.
- At least two IPC families have executable response/error contract coverage.
- SQLite contention has a reproducible measurement and an explicit no-pool or
  follow-up-worker decision.
- Existing command names, payload keys, PTY ownership, path authorization,
  remote protocol versions, and persistence semantics do not regress.
- Full verification passes at Prompt 19.
- The plan is not marked complete until the merged PR and post-merge baseline
  are recorded.

## Risks and recovery

- **Scope creep:** each prompt owns one family/seam; stop and split when a diff
  crosses unrelated domains.
- **Error contract breakage:** preserve command names/payloads and add contract
  tests before changing adapters.
- **Migration/data loss:** keep transactions, copied fixtures, future-version
  rejection, and recovery notes; never silently drop user data.
- **PTY regression:** do not refactor PTY ownership or renderer pooling in this
  goal; use existing terminal-input and lifecycle tests.
- **Dependency churn:** record a decision before adding Specta, coverage tools,
  jsdom, cargo-deny, or any other new package.
- **Dirty worktree contamination:** stage explicit paths only; preserve the
  pre-existing untracked codebase report and never reset/clean the worktree.

## Validation cadence

Every prompt: focused tests and `git diff --check`.

Every fifth prompt: frontend typecheck/build or Rust check/test/clippy/fmt,
depending on the touched side.

Prompt 19: complete repository verification and fresh metrics.

## Result

Prompt 01 complete. Evidence commands and values are recorded above; no source
code was changed. This feature goal remains active across the remaining
nineteen prompt turns.
