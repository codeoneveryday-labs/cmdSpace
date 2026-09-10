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
| Registered Tauri command entries | 103 | entry-only parse of `cmdspace_commands!` in `src-tauri/src/commands.rs` |
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

Prompt 19 corrected the initial command inventory parser: the entry-only count
is 103 (the earlier 104 figure included one non-entry macro line). This is a
measurement correction, not a command-registry change.

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

**Status:** complete. `fs_read_file` now maps native I/O kinds to stable
`FS_*` codes and safe messages; success discriminants remain unchanged. The
FS test group passes with 19 tests.

### Prompt 05 — Lock the filesystem IPC response/error contract

**Owner seam:** `src/modules/ai/lib/native.ts` and filesystem contract tests.

**Work:** Add a typed adapter for the Prompt 04 response and error envelope.
Ensure callers branch on discriminants/codes rather than matching error prose.
Keep the two-process rule and workspace environment forwarding explicit.

**Proof:** frontend contract tests verify command name, payload keys, response
discriminants, and error-code handling; `tauriCommandRegistry` stays green.

**Status:** complete. A shared `TauriIpcError` parser now preserves stable
codes while remaining an `Error`, `native.readFile` wraps structured FS
failures, and workspace IPC keeps its existing parser export for compatibility.
Seven focused tests and TypeScript typecheck pass.

### Prompt 06 — Migrate one shell command vertical slice

**Owner seam:** `src-tauri/src/modules/shell/mod.rs`.

**Work:** Classify `shell_run_command` failures (empty command, unauthorized
cwd, timeout, spawn, output truncation) without changing timeout limits or
process cleanup. Keep one-shot shell execution distinct from PTY sessions.

**Proof:** Rust tests cover each classification and timeout path; existing
frontend `CommandOutput` success behavior is unchanged.

**Status:** complete. `shell_run_command` now exposes stable `SHELL_*` errors
for validation, cwd authorization, build/spawn/pipe/wait/worker failures;
timeout and truncation remain explicit fields on `CommandOutput`. Shell tests
cover success, timeout, truncation, and error serialization.

### Prompt 07 — Harden workspace authorization errors

**Owner seam:** `src-tauri/src/modules/workspace_auth.rs` and WSL adapters.

**Work:** Convert one authorization boundary to stable codes for missing cwd,
outside authorized root, symlink escape, invalid WSL distro, and inaccessible
directory. Preserve the security decision and platform-specific path rules.

**Proof:** existing authorization tests plus new code-serialization assertions
prove no unauthorized spawn path is widened.

**Status:** complete. Workspace cwd failures now classify as inaccessible,
not-a-directory, or outside-authorized-root; WSL validation has a stable
invalid-distro code. Existing callers retain a safe string compatibility path,
and the authorization test group passes without widening any root.

### Prompt 08 — Classify outbound AI/network errors

**Owner seam:** `src-tauri/src/modules/net.rs`, `net_http.rs`,
`net_security.rs`.

**Work:** Keep SSRF/DNS-rebinding guards as the authority while separating
invalid URL, blocked target, timeout, transport, and upstream status errors.
Do not broaden allowed hosts or expose response bodies containing secrets.

**Proof:** focused tests cover blocked private targets, allowed HTTPS, timeout,
and upstream failure code mapping.

**Status:** complete. Network URL/DNS/SSRF/header/client/request/stream
failures now map to `NET_*` codes and safe messages; private-network and
metadata-host policy is unchanged. Nine network security tests pass.

### Prompt 09 — Stabilize a PTY command error seam

**Owner seam:** `src-tauri/src/modules/pty_commands.rs` and `pty_state.rs`.

**Work:** Add a narrow error classification for write/resize/close/list when a
session is absent or a native operation fails. Preserve raw byte streaming,
session ownership, Windows Job Object behavior, and `SPAWN_LOCK` semantics.

**Proof:** Rust tests cover unknown-session and success paths; terminal bridge
contract tests confirm command/payload compatibility.

**Status:** complete. PTY write/resize/metadata/state/remote helper failures
now classify as `PTY_*` errors with safe messages; raw output channels and
session cleanup remain unchanged. The PTY test group passes with 57 tests.

### Prompt 10 — Harden remote boundary errors

**Owner seam:** `src-tauri/src/modules/remote/` and `remote_auth*`.

**Work:** Choose one remote authentication or device-attachment slice and map
unauthorized, expired grant, revoked device, unavailable runtime, and retryable
transport errors. Keep browser v2 and native device v3 contracts separate.

**Proof:** focused remote tests cover auth rejection, retryable transport, and
capability denial without turning relay outage into authentication failure.

**Status:** complete. Native device authorization now distinguishes unknown,
revoked, registry-unavailable, and capability-denied states with stable
internal codes while preserving protocol responses and retry flags. The remote
test group passes with 76 tests.

### Prompt 11 — Decide manual versus generated IPC typing

**Owner seam:** existing workspace IPC and command registry contract.

**Work:** Evaluate generated bindings versus the current manual DTO approach.
Record drivers, rejected alternatives, dependency/license/build impact, and a
small candidate family. Do not add Specta or another dependency by default.

**Proof:** an ADR or plan decision names one chosen path, compatibility rules,
and a concrete pilot; no command/payload drift occurs.

**Status:** complete. Decision 0013 keeps manual typed DTOs plus executable
contract tests until a second-family drift signal justifies code generation;
Specta remains deferred without a compatibility/dependency proof.

### Prompt 12 — Expand IPC contract coverage to a second family

**Owner seam:** `src/lib/tauriCommandRegistry.contract.test.ts` plus the
selected filesystem/shell/workspace bridge.

**Work:** Add response discriminants and stable error-code assertions beside
the existing invoke-name/payload checks. Keep the contract test focused on wire
invariants, not implementation text.

**Proof:** intentional command/payload/error drift fails a focused test; valid
frontend/Rust contracts pass.

**Status:** complete. `fs_read_file` now has an executable response parser,
centralized `ReadResult` type, stable error handling, and invalid-wire-shape
coverage. Eight focused IPC tests and TypeScript typecheck pass.

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

**Status:** complete. Executable tests now cover macOS printable-key routing,
modified/control/navigation-key fallthrough, single-character xterm filtering,
textarea blur/refocus resynchronization, C1/NBSP normalization, composition
duplicate suppression, Enter observation ordering, and mouse-report broadcast
exclusion. The existing source guards remain as compatibility assertions and
were not expanded.

### Prompt 14 — Convert persistence/workspace structural claims

**Owner seam:** `src/app/lib/useWorkspaceHydration.ts`, workspace IPC, and DB
tests.

**Work:** Add executable proof for fresh DB hydration, legacy migration,
unknown future schema rejection, pinned workspace restoration, and pane-layout
round trips. Keep workspace/tab ownership in existing hooks.

**Proof:** Rust + Vitest integration/model tests prove behavior without relying
only on `readFileSync(...).toContain(...)`.

**Status:** complete. Fresh in-memory schema hydration now has a dedicated
round-trip test for pinned workspaces, pane layout, and pane launch metadata;
legacy migration, future-schema rejection, and migration rollback remain
executable Rust coverage. Frontend hydration tests also pin legacy defaults,
persisted pinning/pane layout, and transient tab ownership reset.

### Prompt 15 — Convert remote/security structural claims

**Owner seam:** `src-tauri/src/modules/remote/`, `src/remote/`, and security
tests.

**Work:** Replace a bounded batch of source assertions with executable tests for
protocol version rejection, auth token handling, device capability denial,
sequence replay handling, and LAN/tunnel fallback. Keep secrets redacted in
logs and fixtures.

**Proof:** remote unit/integration tests exercise parsers/state transitions;
source-guard count does not increase.

**Status:** complete. Remote behavior coverage now includes explicit v2
protocol rejection, browser token/authentication handling, view-only device
capability denial, stale/out-of-order sequence suppression, and ready-tunnel
versus degraded-LAN fallback. The remote Rust group passes 77 tests and the
focused browser protocol/client suite passes 9 tests; no source guard was
added.

### Prompt 16 — Add scoped Rust unwrap/expect enforcement

**Owner seam:** touched native modules only.

**Work:** Inventory non-test `unwrap`/`expect` in the touched slices. Add
scoped clippy policy or replace the highest-risk cases with typed propagation;
do not turn the whole historical codebase red in one prompt.

**Proof:** touched modules pass `cargo clippy -- -D warnings` with the scoped
policy; every remaining exception is documented and bounded.

**Status:** complete. The six typed native error seams now deny
`clippy::unwrap_used` and `clippy::expect_used` locally; test-only serializer
fixtures are the only explicitly allowed exceptions. The policy is scoped to
new boundary modules and does not turn historical command/session code red.
All-target Clippy and the seven scoped error-module tests pass.

### Prompt 17 — Add structured context to one existing log boundary

**Owner seam:** DB or remote command boundary, using existing `log` support.

**Work:** Add operation/domain context, outcome, and duration where it improves
diagnosis. Redact paths, tokens, prompt contents, and secrets. Do not add a
new logging dependency or redesign all logging in one pass.

**Proof:** focused tests or log-capture checks prove stable fields and redaction;
manual review confirms no user input is logged raw.

**Status:** complete. `db_list_workspaces` now emits one existing-log-target
event with stable domain/operation/outcome/duration fields. The formatter takes
only a fixed operation name, safe error code, and duration, so paths, tokens,
workspace payloads, and prompt contents cannot enter this event. A DB unit test
pins the shape and redaction-by-construction; 14 DB tests and all-target
Clippy pass.

### Prompt 18 — Make the DB extraction decision from measurements

**Owner seam:** DB measurement harness and plan/ADR.

**Work:** Compare Prompt 02 metrics against an explicit threshold agreed in the
plan. If contention is low, document why the mutex remains. If contention is
material, write a separate bounded design for a DB worker/pool; do not implement
the extraction in the same prompt.

**Proof:** reproducible report includes workload, p50/p95/p99, hardware/runtime,
and a go/no-go decision with rejected alternatives.

**Status:** complete. Decision 0014 keeps the mutex-backed connection because
two same-host runs of the 4-worker/40-iteration harness remain below the
explicit materiality thresholds (lock-wait p95 >1 ms or operation p95 >5 ms
for three consecutive runs). The repeat run reported lock wait
`42/167/783750 ns`, operation `15750/29791/44166 ns`, and schema startup
`590167/719916/719916 ns`; no pool/worker is implemented in this prompt.

### Prompt 19 — Final verification and baseline re-pin

**Owner seam:** repository validation and plan state.

**Work:** Run focused tests for all changed slices plus `pnpm exec tsc --noEmit`,
`pnpm test`, `pnpm build`, `cargo check --all-targets --locked`, `cargo test
--all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`,
`cargo fmt --all -- --check`, `pnpm quality:warn`, and `git diff --check`.
Re-measure command/error/test taxonomy from the clean candidate SHA.

**Proof:** all required checks pass, the plan records exact outputs/counts,
and no known error remains hidden behind a claim of completion.

**Status:** complete. Candidate verification ran from tracked commit
`28051f2014ad67b3846eb52585ff37c201cf8933` with only the pre-existing
untracked codebase report outside the staged scope. `pnpm exec tsc --noEmit`,
`pnpm test` (447 Vitest files / 1,244 tests plus 6 relay tests), `pnpm build`
(2,774 modules), `cargo check --all-targets --locked`, `cargo test
--all-targets --locked` (281 tests), `cargo clippy --all-targets --locked --
-D warnings`, `cargo fmt --all -- --check`, and `git diff --check` all pass.
`pnpm quality:warn` exits 0 with five existing warn-only tool/baseline
warnings. The candidate taxonomy is: 103 registered commands, 46 frontend
invoke files, 165 `Result<_, String>` lines, 303 Rust test attributes, 443
frontend `*.test.ts(x)` files, 247 source guards, 1 IPC contract test, and 285
rough unwrap/expect hits (inventory-only, including inline test modules).

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
- [x] Prompt 04 — Migrate `fs_read_file` to stable FS errors; 19 FS tests,
  fmt, and Clippy pass.
- [x] Prompt 05 — Add the shared Tauri error parser and filesystem IPC facade;
  focused IPC tests and typecheck pass.
- [x] Prompt 06 — Type the one-shot shell command boundary; 13 shell tests,
  fmt, and Clippy pass.
- [x] Prompt 07 — Type workspace authorization/WSL validation errors; 24
  workspace-related tests, fmt, and Clippy pass.
- [x] Prompt 08 — Type network/SSRF error outcomes; 9 security tests, fmt, and
  Clippy pass.
- [x] Prompt 09 — Type PTY command/state errors; 57 PTY-related tests and
  Clippy pass.
- [x] Prompt 10 — Harden native-device authorization errors; 76 remote tests
  and Clippy pass.
- [x] Prompt 11 — Decide manual versus generated IPC typing in Decision 0013.
- [x] Prompt 12 — Add filesystem response/error contract and parser tests;
  eight focused IPC tests and typecheck pass.
- [x] Prompt 13 — Convert terminal/IME structural claims to behavior proof;
  32 focused terminal/IME/broadcast tests and typecheck pass.
- [x] Prompt 14 — Convert persistence/workspace structural claims to behavior
  proof; 13 DB tests, 7 focused Vitest tests, fmt, and typecheck pass.
- [x] Prompt 15 — Convert remote/security structural claims to behavior proof;
  77 remote Rust tests, 9 browser protocol/client tests, fmt, Clippy, and
  typecheck pass.
- [x] Prompt 16 — Add scoped Rust unwrap/expect enforcement; all-target Clippy
  and 7 error-module tests pass.
- [x] Prompt 17 — Add structured context to the DB list boundary; 14 DB tests,
  fmt, and all-target Clippy pass.
- [x] Prompt 18 — Decide DB extraction from measured contention in Decision
  0014; repeat harness and runtime metadata recorded.
- [x] Prompt 19 — Run final verification and re-pin metrics from candidate
  `28051f201`; all frontend/Rust gates pass and the warn-only quality baseline
  is recorded.
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
