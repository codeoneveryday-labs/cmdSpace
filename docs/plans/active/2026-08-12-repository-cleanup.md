# Execution Plan: Evidence-based repository cleanup

Date: 2026-08-12

## Status

Completed

## Outcome

Remove only dependencies, source code, and tracked files proven unreachable or unused, without changing product behaviour.

## Context

- User requested removal of unused libraries, code, and files.
- `AGENTS.md` requires an explicit cleanup plan, regression proof before cleanup, and no deletion without user permission. The request authorizes removal after targets are identified.

## Scope

In scope:

- JavaScript/TypeScript dependency declarations and their direct imports.
- Rust dependency declarations and direct crate usage.
- Unreferenced source files, exports, styles, and build/config duplicates.
- Focused tests and build/typecheck validation.

Out of scope:

- Generated build output, user data, historical documentation, or lockfile-wide upgrades.
- Behavioural refactors and new abstractions.

## Approach

1. Establish a clean baseline with existing build/typecheck and focused tests.
2. Inventory dependencies from manifests, lockfiles, import graphs, and repository configuration.
3. Classify candidates as proven unused, conditionally used (scripts/config/runtime), or uncertain.
4. Delete only proven-unused candidates, one bounded pass at a time, and update manifests/lockfiles only as required.
5. Re-run focused tests and production build after each deletion pass, then repository-required checks.

## Risks And Recovery

- Static searches can miss dynamic imports or runtime configuration. Inspect build/tool configuration and test the release build before removal.
- A package can be needed only by the native crate or a script. Search all tracked files before removing it.
- Recovery: each deletion remains a small git diff and can be reverted selectively; no destructive git or filesystem commands are used.

## Progress

- [x] Capture baseline validation.
- [x] Produce evidence-backed candidate inventory.
- [x] Remove proven dead dependencies/files.
- [x] Validate focused paths and full production build.

## Decisions

- 2026-08-12: Use an evidence-only threshold; ambiguous candidates remain and are reported rather than removed.

## Validation

- Focused proof: affected Vitest suites.
- Repository-required checks: `pnpm build`, relevant `cargo check --all-targets --locked`, and diff whitespace check.

## Result

Removed stale generated Vite configuration (`vite.config.js` and `.d.ts`), 15
unused direct npm dependencies, and 16 unreachable UI/helper source files.
Vite now consistently loads `vite.config.ts`; its source-level test was updated
to assert only that canonical configuration.

Validation passed: `pnpm vitest run` (101 files, 501 tests), `pnpm build`,
`cargo check --all-targets --locked`, and `git diff --check`.

Retained native Tauri plugins, build tooling, type packages, and code whose
runtime use cannot be proven absent from static imports. A later pass can
review feature-level dormant modules with product ownership rather than remove
them mechanically.
