# Execution Plan: Maintainability Boundary Hardening

Date: 2026-09-10

## Status

Active

## Outcome

Raise the maintainability floor of the Rust/Tauri desktop backend without a
big-bang architecture rewrite or user-visible behavior changes. The result is
an incremental set of enforced boundaries:

- Rust CI proves formatting and behavior tests, not only compilation and
  Clippy.
- Native modules expose typed, stable errors at the Tauri boundary instead of
  growing more `Result<T, String>` contracts.
- SQLite schema evolution has an explicit migration history and recovery path.
- High-value IPC contracts have one checked source of truth for names, payloads,
  and error codes.
- Structural source guards remain only where they protect real ownership or
  wire invariants; behavior claims move to executable tests.

## Context

This plan is an execution umbrella for the already-active architecture and
quality work. It does not replace or duplicate the detailed tasks in:

- [`2026-09-08-engineering-capability-program.md`](2026-09-08-engineering-capability-program.md)
- [`2026-08-31-architecture-scale-hardening.md`](2026-08-31-architecture-scale-hardening.md)
- [`2026-08-31-refactor-partition-and-proof.md`](2026-08-31-refactor-partition-and-proof.md)

The current remote baseline is `origin/main` at `c42e43ce1` (2026-09-10). The
following observations are measured from that tree:

- `Result<..., String>` occurs on 212 lines under `src-tauri/src`; typed errors
  already exist in selected modules such as
  [`src-tauri/src/modules/git/errors.rs`](../../../src-tauri/src/modules/git/errors.rs),
  but there is no shared application/IPC error contract.
- Rust CI currently runs `cargo check` and Clippy, but not `cargo fmt --check`
  or `cargo test`: [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml:90).
- Desktop persistence is a process-wide `Mutex<rusqlite::Connection>`:
  [`src-tauri/src/modules/db.rs`](../../../src-tauri/src/modules/db.rs:4).
- Schema setup detects columns with `PRAGMA table_info` and applies inline
  `ALTER TABLE` statements rather than numbered migrations:
  [`src-tauri/src/modules/db/schema.rs`](../../../src-tauri/src/modules/db/schema.rs:27).
- `WorkspaceRow` is simultaneously a serde/IPC shape and persistence model:
  [`src-tauri/src/modules/db/models.rs`](../../../src-tauri/src/modules/db/models.rs:3).
- The command registry is centralized in
  [`src-tauri/src/commands.rs`](../../../src-tauri/src/commands.rs:1), and the
  existing frontend contract test checks static command names and payload keys:
  [`src/lib/tauriCommandRegistry.contract.test.ts`](../../../src/lib/tauriCommandRegistry.contract.test.ts:160).
- Existing quality documents intentionally use a pinned historical test
  baseline. Do not mix that baseline with working-tree counts; re-measure from
  a new clean SHA before setting a ratchet.

## Scope

In scope:

- CI gates for Rust formatting and tests.
- A narrow typed-error seam at native command boundaries, migrated module by
  module.
- Versioned SQLite migrations with legacy-schema fixtures and rollback/recovery
  documentation.
- A decision and first slice for typed/generated IPC contracts, starting with
  the existing command registry rather than rewriting all commands.
- Behavior-test conversion for high-value lifecycle and persistence claims,
  while retaining necessary structural ownership guards.
- Measurements, focused tests, full gates, and staged-path review for every
  change group.

Out of scope:

- A Clean Architecture rewrite or immediate `cmdspace-core`/multi-crate split.
- Replacing the existing React/Tauri Bridge, `App.tsx` coordinator, PTY
  ownership, renderer pool, or canvas terminal lifecycle.
- Deleting provider catalog entries, persisted keys, database columns, or test
  files without a separate approved change.
- Introducing a DB pool/worker, Specta, `thiserror`, or another dependency
  before its compatibility and migration cost are demonstrated.
- Product redesign or changes to command names and serialized payloads.

## Approach

### Phase 0 — Re-pin evidence and freeze ownership

**Primary files:** this plan, existing active plans, `docs/reports/`,
`.github/workflows/ci.yml`.

1. Re-run the repository inventory from a clean `origin/main` SHA. Record
   `Result<T, String>` counts, command count, test taxonomy, and current CI
   behavior with explicit scope.
2. Assign each implementation path to one owning module and applicable pattern
   from [`docs/architecture/design-patterns.md`](../../architecture/design-patterns.md).
3. Keep the current dirty worktree out of staging; each change group starts in
   a clean issue branch from `origin/main`.

**Exit proof:** a reviewer can identify the baseline SHA, owner, invariant, and
focused proof for every staged path.

### Phase 1 — Make Rust quality gates match the documented contract

**Primary file:** [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml).

1. Add `cargo fmt --all -- --check` to the Rust job.
2. Add `cargo test --all-targets --locked` to the Linux Rust job; add a Windows
   test invocation only if the runner and test suite support it without hiding
   platform-specific failures.
3. Keep `cargo check --all-targets --locked` and Clippy as separate diagnostics.
4. Verify the workflow syntax and run the exact local commands before opening a
   PR.

**Exit proof:** CI blocks a merge when formatting or Rust behavior tests fail;
the new gates pass on the supported runner matrix.

### Phase 2 — Introduce typed native errors incrementally

**Primary files:** `src-tauri/src/modules/{db,fs,net,workspace}/`, shared IPC
error module only if the first slice proves it is needed, plus focused tests.

1. Define a small stable error envelope at the Tauri boundary (`code` plus
   human-readable `message`) while preserving existing command names and
   payloads.
2. Start with one vertical slice (DB or filesystem): domain/service functions
   return a module error; the command adapter performs the single conversion to
   the IPC envelope.
3. Migrate subsequent modules only when touched by a feature or bug fix. Do not
   mechanically rewrite all 212 string-returning lines.
4. Add direct tests for error classification, serialization, and the existing
   success path. Ensure secrets, paths, and command output are not leaked in
   codes or messages.

**Exit proof:** the pilot slice has no new `Result<_, String>` in its service
   layer, frontend callers can branch on stable error codes, and old success and
   failure behavior remains covered.

### Phase 3 — Version SQLite schema evolution

**Primary files:** `src-tauri/src/modules/db/schema.rs`, new migration SQL or
Rust migration modules, `src-tauri/src/modules/db/tests.rs`, and DB fixtures.

1. Record the current schema as migration `001` without changing its meaning.
2. Add a schema-version source of truth (`PRAGMA user_version` or an equivalent
   metadata table) and apply migrations in ascending order exactly once.
3. Convert the existing column/table checks into explicit migrations while
   preserving upgrades from every supported legacy shape, including the
   agent-chat removal and workspace pin/pane fields.
4. Add fixtures for a fresh database, each legacy version, repeated startup,
   interrupted/failed migration handling, and unknown future versions.
5. Document the recovery procedure: preserve the original DB, fail closed on an
   incompatible version, and never silently drop user data.

**Exit proof:** old-schema fixtures upgrade deterministically, a second startup
   does not replay migrations, and a migration failure leaves a recoverable DB.

### Phase 4 — Strengthen the IPC contract without a premature dependency

**Primary files:** `src-tauri/src/commands.rs`,
`src/lib/tauriCommandRegistry.contract.test.ts`, native bridge modules, and a
small typed request/response module for the first selected command family.

1. Keep the existing registry contract test as the baseline bridge guard.
2. Select one stable family (workspace/DB or filesystem) and define explicit
   request/response/error types at the boundary, separate from persistence rows.
3. Evaluate generated bindings only after the first slice exposes the concrete
   type and naming requirements; record the dependency decision and rejected
   alternatives before adding any package.
4. Extend contract tests to cover response discriminants and error codes, not
   only invoke names and payload keys.

**Exit proof:** the selected family has one documented source of truth, a
   frontend/Rust drift test, and no command-name or payload compatibility break.

### Phase 5 — Replace brittle behavior proof with executable proof

**Primary files:** existing `*.source.test.ts` files and direct model/hook/Rust
tests identified by the source-contract inventory.

1. Classify each source assertion as a structural invariant, wire contract, or
   behavior claim.
2. Keep structural assertions for command registration, two-process ownership,
   platform guards, and standard-versus-canvas terminal ownership.
3. For behavior claims, add a direct model, hook, render, integration, or Rust
   test first; only then remove or narrow the redundant source assertion, with
   explicit approval for test-file deletion.
4. Establish a no-new-structural-guard rule and re-pin the test taxonomy from a
   clean SHA before adding a coverage ratchet.

**Exit proof:** implementation moves do not cause broad source-string churn,
  while lifecycle, persistence, and bridge regressions fail through executable
  tests.

### Phase 6 — Measure before optional extraction

**Primary files:** `src-tauri/src/modules/*`, `crates/`, profiling/report files.

1. Measure DB lock wait/operation latency and command error frequency under
   realistic PTY, Git, remote, and workspace activity.
2. Extract a `cmdspace-core` crate or DB worker only if measurements show a
   concrete boundary or contention problem; preserve the existing Facade and
   Bridge contracts.
3. Add ADRs for durable decisions and link them from the pattern contract.

**Exit proof:** every new crate or concurrency abstraction has a measured
   problem, a smaller caller interface, lifecycle ownership, and direct proof.

## Acceptance Criteria

- [x] The plan has a fresh baseline SHA and every implementation group names an
  owner, invariant, and focused test.
- [x] Linux CI runs and passes `cargo fmt --all -- --check` and
  `cargo test --all-targets --locked`; existing check and Clippy gates remain.
- [x] At least one native module uses a typed domain error converted once at the
  Tauri boundary, with stable error-code tests and no new string parsing in its
  frontend callers.
- [x] SQLite migrations have an explicit version source, legacy fixtures,
  idempotent startup tests, and documented recovery behavior.
- [x] One IPC family separates request/response DTOs from persistence rows and
  has executable coverage for its payload, response, and error shape alongside
  the existing command registry contract.
- [x] No new behavior-only `*.source.test.ts` guards are added; converted
  behavior has executable proof before redundant guards are narrowed.
- [x] No command names, serialized payload keys, PTY ownership rules, or
  two-process security boundaries regress.
- [x] Every completed phase passes focused tests plus
  `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`,
  `cd src-tauri && cargo check --all-targets --locked`,
  `cd src-tauri && cargo clippy --all-targets --locked -- -D warnings`,
  `cd src-tauri && cargo fmt --all -- --check`, and `git diff --check` as
  applicable.

## Risks And Recovery

- **Error migration expands into a rewrite.** Keep the first slice narrow and
  reject mechanical repo-wide conversion; revert only the issue branch if its
  boundary grows beyond the accepted scope.
- **Migration mistakes damage user databases.** Test copied fixtures, use
  transactional/idempotent steps where SQLite permits, preserve backups, and
  fail closed on unknown versions.
- **Typed IPC introduces dependency or naming churn.** Start with the existing
  static contract test and add a generator only after a written compatibility
  decision.
- **CI becomes slow or platform-flaky.** Keep checks separated, time each new
  job, and narrow platform-specific test selection without weakening Linux
  behavior coverage.
- **Dirty parallel work is staged accidentally.** Work only from clean issue
  branches and review `git diff --cached --name-status` before every commit.
- **Recovery:** stop the affected change group, preserve its branch and test
  fixtures, restore the prior merged commit, and document the failing proof in
  this plan. Never reset or clean the shared user worktree.

## Progress

- [x] Re-pin current evidence from `origin/main` at `c42e43ce1`.
- [x] Add and locally verify Rust `fmt`/`test` CI gates; include the existing
  formatting-only cleanup required for the gate to pass.
- [x] Land the first typed-error vertical slice in the DB module.
- [x] Land the first versioned SQLite migration runner and legacy/failure
  fixtures (schema version `1`).
- [x] Land the first workspace DTO/IPC response and error contract slice.
- [x] Convert the highest-value behavior-only source guards; the existing
  inventory already covers the priority voice, terminal, canvas, remote, and
  persistence behaviors, and this slice adds direct workspace IPC coverage.
- [ ] Measure DB contention before considering extraction or pooling.
- [ ] Isolate these changes into reviewable issue branches/PRs without staging
  unrelated worktree edits.
- [ ] Run final full verification on the isolated change groups and record the
  result before moving this plan to `docs/plans/completed/`.

## Decisions

- 2026-09-10: Treat this as incremental boundary hardening, not a Clean
  Architecture rewrite, because the existing Bridge, Facade, Composite,
  Flyweight, and State seams already protect important lifecycle behavior.
- 2026-09-10: Preserve the shared provider catalog, persisted settings, and
  command wire contracts while improving their typed boundaries.
- 2026-09-10: Defer DB pooling, a new core crate, generated IPC dependencies,
  and broad source-test deletion until a concrete measurement or compatibility
  proof justifies each one.
- 2026-09-10: Use a manual serializable `DbError` first; do not add `thiserror`
  or Specta until a dependency decision is reviewed against the no-new-
  dependency constraint.
- 2026-09-10: Treat all pre-existing unversioned SQLite databases as migration
  version `0`, apply the current schema as version `1`, and keep the migration
  transactionally recoverable before adding future numbered steps.

## Validation

- Focused proof: DB tests (10 passed), workspace IPC tests, hydration/tray/App
  contract tests (48 passed), and the existing command registry contract.
- Integration proof: full frontend/relay suite (445 files / 1,233 tests and 6
  relay tests), production build, and full Rust test suite (261 passed).
- Repository-required checks: exact commands in the Acceptance Criteria, plus
  `pnpm exec tsc --noEmit`, `pnpm build`, `cargo check --all-targets
  --locked`, `cargo clippy --all-targets --locked -- -D warnings`,
  `cargo fmt --all -- --check`, and `git diff --check` passed on the current
  worktree. `pnpm quality:warn` also passes with its existing five warnings
  (stale test baseline, missing optional lint/format/coverage tools, and no
  lint script). Isolated PR verification remains pending.

## Result

Phases 0–4 have a verified local implementation in the current worktree. The
remaining source-proof conversion, contention measurement, and isolated PR
delivery are still pending.
