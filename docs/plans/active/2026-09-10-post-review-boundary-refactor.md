# Execution Plan: Post-review Boundary Refactor

Date: 2026-09-10

## Status

Active

## Outcome

Reduce the remaining native-boundary entropy identified in the latest
architecture review without rewriting cmdSpace. The work will migrate the
highest-risk `Result<_, String>` families to stable typed errors, add a second
executable IPC response contract beyond filesystem reads, make a measured
database-migration decision, and test one service seam before considering any
larger extraction.

The observable result must preserve command names, payload keys, PTY ownership,
workspace authorization, remote protocol versions, secret semantics, and
persistence behavior while making failures machine-readable and easier to
evolve.

## Context and current evidence

The current `main` baseline is `17f122cf43332d3b0d8ef7ee7fc2661a80f38d5c`
(PR #458 implementation plus PR #459 plan closeout). The previous 20-prompt
goal is complete at
[`2026-09-10-maintainability-refactor-feature-goal.md`](../completed/2026-09-10-maintainability-refactor-feature-goal.md).

The review's positive architectural observations remain supported by the
repository:

- `src-tauri/src/lib.rs:1-10` keeps bootstrap imports grouped by domain;
  `src-tauri/src/lib.rs:249-279` manages domain state and invokes the grouped
  command macro.
- `src-tauri/src/commands.rs:1-123` exposes 103 entry-only command registrations
  grouped by domain.
- The two-process Bridge and existing ownership invariants are documented in
  [`docs/architecture/design-patterns.md`](../../architecture/design-patterns.md)
  and [`AGENTS.md`](../../../AGENTS.md).

The review is stale in two important places:

- Typed native errors already exist for DB, filesystem, shell, workspace,
  network, PTY, and selected remote-device paths. The current Rust inventory is
  165 `Result<_, String>` lines, down from the previous 241-line baseline; the
  remaining surface is concentrated in Git, secrets, speech, shell/platform,
  and remote helpers.
- SQLite now reads and writes `PRAGMA user_version` and rejects future versions
  in `src-tauri/src/modules/db/schema.rs:268-320`. The legacy version-1 upgrade
  still uses defensive inline column/table checks at `:157-266`, so the review's
  migration concern is partially valid rather than completely unresolved.

The typed-IPC concern remains valid but intentional: the filesystem adapter
validates a discriminated response in `src/modules/ai/lib/native.ts:15-55`,
while Decision 0013 defers generated bindings until a second-family drift
signal exists. There is currently one `*.contract.test.ts` family.

The pre-existing untracked
`docs/reports/2026-09-09-codebase-review.md` is outside this plan and must stay
unstaged.

## Scope

In scope:

- Stable error codes and safe serialized messages for the highest-risk remaining
  native families, starting with Git and secrets, then one remote/auth family.
- Executable frontend/Rust contract coverage for Git status/panel responses and
  stable error handling.
- A second-family typed-IPC/code-generation decision backed by actual
  duplication or drift evidence.
- A database migration architecture gate: either introduce a real numbered
  migration seam for the next schema change, or document why version-1 legacy
  normalization remains intentionally inline until a real v2 exists.
- One measured service-boundary pilot around Git command adaptation, only if it
  hides blocking, workspace authorization, and error conversion behind a
  smaller interface.
- Scoped lint/logging updates for touched modules, full verification, and one
  reviewable delivery PR.

Out of scope:

- A global `AppError`, `thiserror`, Specta/tauri-specta, or another new
  dependency without a separate compatibility decision.
- A `cmdspace-core` crate, DB pool/worker, or Clean Architecture rewrite.
- Renaming commands, changing serialized payload keys, or changing frontend
  success shapes.
- PTY ownership, renderer pooling, canvas lifecycle, remote protocol versions,
  or workspace authorization policy changes.
- Deleting existing tests/source guards or staging unrelated worktree files.

## Working contract

Each prompt is one independently verifiable slice:

1. Read the owning module, pattern invariant, and current tests.
2. Add or strengthen executable proof before changing a boundary.
3. Make the smallest compatible implementation change.
4. Run focused tests, `git diff --check`, and the relevant type/lint check.
5. Commit with a conventional message and Lore trailers.

No prompt may introduce a second IPC path or silently convert a safe native
error into user-controlled prose.

## Prompt slices

### Prompt 01 — Re-pin the remaining migration surface

**Owner:** plan and repository inventory.

Record exact counts for command entries, `Result<_, String>` by module,
frontend `invoke()` files, response-contract tests, source guards, and
non-test `unwrap`/`expect` in the current `main` tree. Classify each candidate
family as user-visible, security-sensitive, or internal-only.

**Exit proof:** reproducible inventory from the pinned SHA; no source changes;
the pre-existing report remains unstaged.

**Status:** complete. From `17f122cf4`, the entry-only registry has 103
commands, the native tree has 165 `Result<_, String>` lines, and the frontend
has 46 `invoke()` callers, 443 test files, 247 source guards, and one IPC
contract test. The targeted remaining families are Git (15 lines; user-facing),
secrets (7; security-sensitive), and remote auth (5; network/auth-sensitive).

### Prompt 02 — Type the Git error boundary

**Owner:** `src-tauri/src/modules/git/errors.rs`, `git/commands.rs`, and Git
operation tests.

Extend the existing `GitError` into a serialized safe envelope with stable
`GIT_*` codes. Keep native path/output details in the native error value but
out of the serialized envelope; preserve Git
authorization and process behavior. Convert once at the Tauri command adapter
and keep `GitError` rich enough for native diagnostics.

**Exit proof:** tests cover missing Git, unauthorized path, auth-required,
timeout, no-upstream, invalid input, and command failure without leaking a
path/token; command names and success DTOs remain unchanged.

**Status:** complete. All Git command adapters now return `GitResult<T>` and
the worker join path has a stable `GIT_WORKER_UNAVAILABLE` failure. `GitError`
serializes only `{ code, message }`, preserving native diagnostic fields while
keeping paths, command output, and credential details out of IPC. The Git
family now has zero `Result<_, String>` lines; 22 focused Git tests, all-target
Clippy, frontend command-registry contracts, and TypeScript typecheck pass.

**Pattern impact:** the Tauri Command/Bridge contract changes only its error
serialization; command names, parameters, success DTOs, and the existing
`commands -> operations -> process` ownership remain intact.

### Prompt 03 — Type the secrets boundary without exposing credentials

**Owner:** `src-tauri/src/modules/secrets.rs` and platform-specific tests.

Introduce a `SecretsError` classification for keychain/file backend
unavailable, invalid service/account input, serialization, and storage failure.
Keep secret values out of `Display`, serialized messages, logs, and test
failure text. Preserve Linux 0600 storage and native keychain semantics.

**Exit proof:** Linux and non-Linux-compatible unit tests cover cache miss,
read/write/delete failure mapping, and redaction; no secret payload or path is
returned through the IPC error envelope.

### Prompt 04 — Finish one remote/auth error family

**Owner:** `src-tauri/src/modules/remote/auth.rs` and the existing remote auth
tests.

Classify rate-limited, expired/tampered token, invalid bootstrap, password
setup, and persistence failures. Keep browser v2/native device v3 contracts,
retry flags, rate limiting, and session revocation unchanged.

**Exit proof:** auth tests assert stable codes and safe messages for each class;
the WebSocket/HTTP adapters still emit their existing wire shapes.

### Prompt 05 — Add a typed frontend Git IPC facade

**Owner:** `src/modules/ai/lib/native.ts`, source-control callers, and shared
IPC error utilities.

Add a runtime parser for the selected Git response family (start with
`git_status` or `git_panel_snapshot`) and map native `GIT_*` errors to the
existing `TauriIpcError` type. Do not duplicate DTOs in feature components.

**Exit proof:** malformed success payloads fail closed, stable error codes are
preserved, and source-control callers continue to receive the existing success
shape.

### Prompt 06 — Expand executable IPC contract coverage

**Owner:** `src/lib/tauriCommandRegistry.contract.test.ts` and focused Git
contract tests.

Assert command registration, request keys, response discriminants/fields, and
error-code behavior for the second family. Keep structural assertions only for
registry/wire invariants; behavior assertions must exercise parsers or models.

**Exit proof:** intentional command/payload/response drift fails a focused test;
valid Rust/frontend contracts pass; no new source-only behavior guard is added.

### Prompt 07 — Re-evaluate generated IPC bindings with evidence

**Owner:** Decision 0013 and the two typed IPC families.

Compare manual DTO/parser duplication after Prompts 02–06 against the existing
decision threshold. If drift is not measurable, reaffirm manual contracts and
record why. If drift is measurable, write a dependency/compatibility ADR before
adding any generator; do not add Specta in the same prompt as implementation.

**Exit proof:** one explicit decision, rejected alternatives, compatibility
impact, and a pilot family; no unreviewed dependency lands.

### Prompt 08 — Decide the database migration seam

**Owner:** `src-tauri/src/modules/db/schema.rs`, DB fixtures, and Decision 0014.

Use the existing version-1 legacy normalization and future-version tests to
choose between (a) a numbered Rust migration registry for the next real schema
change, or (b) keeping the v1 compatibility shim inline until v2 is required.
Do not create a fake no-op migration or rewrite user data without a real schema
delta.

**Exit proof:** an ADR/plan decision names the authority, recovery behavior,
legacy/fresh/future fixtures, and the exact trigger for the next migration
extraction.

### Prompt 09 — Pilot one deep service seam only if it earns its depth

**Owner:** `src-tauri/src/modules/git/commands.rs` and `git/operations/`.

Measure whether a `GitService`/adapter can hide blocking execution, workspace
authorization, and error conversion behind a smaller interface. If yes, add
the seam with direct operation tests; if not, document why the current
`commands -> operations -> process` boundary is already deep enough and avoid a
wrapper-only refactor.

**Exit proof:** callers depend on one tested interface, lifecycle and blocking
semantics are unchanged, and the deletion test shows the seam removes caller
complexity rather than moving files.

### Prompt 10 — Ratchet quality at touched boundaries

**Owner:** touched Rust modules and existing `log` facade.

Extend scoped `unwrap`/`expect` denial only to newly migrated boundary modules,
add safe operation context where it improves diagnosis, and keep paths,
tokens, prompt content, and command output redacted. Do not turn the historical
crate-wide inventory into a single blocking rewrite.

**Exit proof:** all-target Clippy, focused redaction/error tests, and diff check
pass; every exception is test-only or documented with a bounded reason.

### Prompt 11 — Full verification and fresh baseline

Run focused tests for every touched family plus TypeScript typecheck, Vitest,
frontend build, Rust check/test/Clippy/fmt, relay tests, quality warnings, and
`git diff --check`. Re-pin command/error/contract/test counts from the candidate
SHA and list any remaining `Result<_, String>` families.

**Exit proof:** all required gates pass, metrics are reproducible, and known
limitations are explicit.

### Prompt 12 — Delivery and closeout

Deliver each coherent group as its own issue branch and PR: Git
(Prompts 01–02), secrets (Prompt 03), remote auth (Prompt 04), IPC
(Prompts 05–07), migration/service/quality (Prompts 08–10), and verification
closeout (Prompts 11–12). Merge each only after CI, fast-forward local `main`
between groups, and move this plan to `docs/plans/completed/` after the final
closeout PR.

**Exit proof:** every group has a merged PR/commit, local `main` is
fast-forwarded after each merge, the final plan is completed, the tracked tree
is clean, and the pre-existing report is still untracked.

## Acceptance criteria

- At least three additional high-value native command families expose stable
  typed error codes and safe messages; no targeted family adds new
  `Result<_, String>` lines.
- At least two IPC families have executable response/error contracts, including
  malformed-response rejection and stable error-code assertions.
- Generated IPC bindings are either justified by a recorded drift signal or
  explicitly deferred without adding a dependency.
- DB migration policy is explicit, transactional, tested against fresh/legacy/
  future schemas, and does not introduce a fake migration.
- A service-boundary pilot either reduces caller complexity or is rejected with
  evidence; no shallow wrapper-only abstraction lands.
- No command names, payload keys, PTY/canvas ownership, remote protocol, secret
  storage, or persistence semantics regress.
- No new behavior-only source guards are added and the existing untracked
  review report is never staged.
- Prompt 11 full verification passes before delivery.

## Risks and recovery

- **Error leakage:** serialize only stable codes/safe summaries; test messages
  against paths, tokens, secrets, and command output.
- **Git behavior drift:** preserve `WorkspaceRegistry` authorization and
  `spawn_blocking`; compare success DTOs before/after.
- **Secrets regression:** test each platform branch and keep Linux file mode
  0600; never log values.
- **Migration damage:** use copied fixtures and transactions; reject unknown
  versions; do not run destructive migration experiments against a user DB.
- **Shallow service split:** apply the deletion test and reject the seam if it
  only moves one call.
- **Dependency churn:** stop at Prompt 07 and write an ADR before adding a
  generator or error crate.
- **Dirty worktree contamination:** stage explicit paths and preserve
  `docs/reports/2026-09-09-codebase-review.md`.

Recovery is prompt-local: keep the branch and fixtures, revert only the
unverified slice, restore the last merged SHA through a normal PR, and update
this plan with the failed proof. Never use destructive reset/clean commands.

## Progress

- [x] Prompt 01 — Re-pin the remaining native-boundary inventory at
  `17f122cf4` and freeze Git, secrets, and remote auth as the next families.
- [x] Prompt 02 — Type the Git error boundary; focused verification passes and
  PR 1 is ready for delivery.
- [ ] Prompt 03 — Type the secrets boundary and ship PR 2.
- [ ] Prompt 04 — Type one remote/auth family and ship PR 3.
- [ ] Prompts 05–07 — Build the second IPC contract family and record the
  generation decision in PR 4.
- [ ] Prompts 08–10 — Decide DB migration, evaluate the Git service seam, and
  ratchet scoped quality in PR 5.
- [ ] Prompts 11–12 — Verify, deliver final PR, merge, update `main`, and
  complete this plan.

## Decisions

- 2026-09-10: Start with Git, secrets, and remote-auth families because they
  have the largest remaining boundary surface and the highest risk of exposing
  unstable/native error prose.
- 2026-09-10: Keep manual typed IPC until the second-family pilot produces
  measurable drift; this follows Decision 0013.
- 2026-09-10: Do not add a DB migration file or worker abstraction without a
  real schema/performance trigger; this follows Decision 0014.
- 2026-09-10: Treat service extraction as an evidence-gated pilot, not a goal
  measured by file count or folder depth.

## Validation cadence

- Every prompt: focused tests and `git diff --check`.
- Prompts 02–04: Rust module tests, serialization/redaction checks, and fmt.
- Prompts 05–07: focused Vitest/typecheck and IPC contract checks.
- Prompt 08: DB migration fixtures and `cargo test --locked db::tests`.
- Prompt 09: Git operation tests and full Clippy.
- Prompt 10: full Rust/frontend checks for touched boundaries.
- Prompt 11: repository-wide verification and fresh inventory.

## Result

Pending implementation. This plan intentionally leaves the completed 20-prompt
goal untouched and turns only the review-confirmed remaining gaps into the next
refactor sequence.
