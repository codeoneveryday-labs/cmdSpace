# Execution Plan: Phase 1 Scalability Boundaries

Date: 2026-08-11

## Status

Completed

## Outcome

Make Phase 1 scalability boundaries explicit without changing product
behavior: record current subsystem seams/state owners, route reviews by
subsystem in CODEOWNERS, and leave the next extraction targets narrower than
the current coordination hubs.

## Context

- Workflow authority: `docs/WORKFLOW.md`
- Living architecture: `CMDSPACE.md`
- Repo map: `COMPREHENSIVE_PLAN.md`
- Phase guidance: `docs/architecture/team-scalability.md`
- Current review routing: `.github/CODEOWNERS`
- Existing boundary proof:
  - `src/app/App.test.ts`
  - `src/modules/terminal/TerminalStack.source.test.ts`
  - `src/modules/architecture/canvasWorkspacePersistence.test.ts`

## Scope

In scope:

- Document current subsystem seams and state owners in a new architecture note.
- Replace the single wildcard CODEOWNERS rule with subsystem path rules while
  preserving the currently authorized GitHub owner handle.
- Validate that the documented terminal, app-shell, and canvas boundaries still
  have focused proof.

Out of scope:

- Any behavioral refactor of `App.tsx`, `TerminalStack.tsx`,
  `ArchitectureCanvas.tsx`, or `src-tauri/src/lib.rs`.
- Assigning new GitHub owner/reviewer handles that are not already authorized
  by repository state.
- Moving this plan to `docs/plans/completed/` from this constrained subtask.

## Approach

1. Read workflow, architecture, and current ownership/test surfaces.
2. Capture the Phase 1 seam registry as a new architecture document instead of
   editing the user-owned in-flight scalability note.
3. Expand CODEOWNERS into subsystem paths using the current owner handle
   `@crynta`, so review routing becomes location-based without inventing new
   reviewers.
4. Run focused proof on existing app-shell, terminal, and canvas boundary
   tests plus diff hygiene checks.

## Risks And Recovery

- Authority risk: the repo currently authorizes only `@crynta` in
  `.github/CODEOWNERS`, so subsystem-specific reviewer expansion stops there.
- Drift risk: the seam registry is a snapshot of the current architecture and
  must be updated when later phases extract modules or move ownership.
- Recovery: revert only the new plan, the new architecture note, and the
  CODEOWNERS path split. No runtime or persistence state is touched.

## Progress

- [x] Read workflow, architecture, and current ownership materials.
- [x] Inspect current focused boundary tests.
- [x] Add a Phase 1 seam registry note under `docs/architecture/`.
- [x] Replace the wildcard CODEOWNERS rule with subsystem-specific paths.
- [x] Run focused validation and diff hygiene checks.

## Decisions

- 2026-08-11: Preserve `@crynta` as the only CODEOWNERS handle because the
  repository does not currently authorize any additional reviewer identities.
- 2026-08-11: Record seams in a new `docs/architecture/phase-1-boundaries.md`
  file instead of editing the untracked in-progress
  `docs/architecture/team-scalability.md`.
- 2026-08-11: Reuse existing source/round-trip tests as Phase 1 proof because
  this change documents and routes boundaries without changing behavior.

## Validation

- Focused proof:
  - `pnpm vitest run src/app/App.test.ts src/modules/terminal/TerminalStack.source.test.ts src/modules/architecture/canvasWorkspacePersistence.test.ts`
- Integration or end-to-end proof:
  - Not applicable; no runtime behavior changed.
- Repository-required checks:
  - `git diff --check`

## Result

Phase 1 now has an explicit seam registry and subsystem-based review routing
without changing runtime behavior. The current owner handle remains unchanged,
so the result improves file-level review locality now and leaves reviewer
expansion for a later, explicitly authorized step.
