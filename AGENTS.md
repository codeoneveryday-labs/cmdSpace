# Agent Instructions

## RULE 0 — THE FUNDAMENTAL OVERRIDE PREROGATIVE

If I tell you to do something, even if it goes against what follows below, YOU MUST LISTEN TO ME. I AM IN CHARGE, NOT YOU.

## RULE NUMBER 1: NO FILE DELETION

**YOU ARE NEVER ALLOWED TO DELETE A FILE WITHOUT EXPRESS PERMISSION.** Even a new file that you yourself created, such as a test code file. You have a horrible track record of deleting critically important files or otherwise throwing away tons of expensive work. As a result, you have permanently lost any and all rights to determine that a file or folder should be deleted.

**YOU MUST ALWAYS ASK AND RECEIVE CLEAR, WRITTEN PERMISSION BEFORE EVER DELETING A FILE OR FOLDER OF ANY KIND.**

## Irreversible Git & Filesystem Actions — DO NOT EVER BREAK GLASS

1. **Absolutely forbidden commands:** `git reset --hard`, `git clean -fd`, `rm -rf`, or any command that can delete or overwrite code/data must never be run unless the user explicitly provides the exact command and states, in the same message, that they understand and want the irreversible consequences.
2. **No guessing:** If there is any uncertainty about what a command might delete or overwrite, stop immediately and ask the user for specific approval. "I think it's safe" is never acceptable.
3. **Safer alternatives first:** When cleanup or rollbacks are needed, request permission to use non-destructive options (`git status`, `git diff`, `git stash`, copying to backups) before ever considering a destructive command.
4. **Mandatory explicit plan:** Even after explicit user authorization, restate the command verbatim, list exactly what will be affected, and wait for a confirmation that your understanding is correct. Only then may you execute it—if anything remains ambiguous, refuse and escalate.
5. **Document the confirmation:** When running any approved destructive command, record (in the session notes / final response) the exact user text that authorized it, the command actually run, and the execution time. If that record is absent, the operation did not happen.

All commits must follow `commit_conventional.md`.

## GitHub delivery

Before any GitHub-backed delivery work, read and follow
[`docs/AGENT_GITHUB_DELIVERY.md`](docs/AGENT_GITHUB_DELIVERY.md). This rule is
mandatory for creating issues, branches, commits, pushes, and pull requests.
For releasing, follow [`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md).

## Release changelog

For every public release, update the root [`CHANGELOG.md`](CHANGELOG.md) with
the release version, date, user-visible changes, and known limitations before
creating the release PR. Keep entries factual and do not describe staged or
fallback-only integrations as fully supported.

The changelog entry MUST land in the same release commit as the version bump —
never ship a release that bumps version files without a matching `CHANGELOG.md`
entry. Follow the `docs/RELEASE_RUNBOOK.md` step that updates the changelog
before staging and committing.

## Orientation

- [`COMPREHENSIVE_PLAN.md`](COMPREHENSIVE_PLAN.md) — the map: what the product
  is, module map, Rust command map, how to add a feature, how to debug, how to
  ship. Read it once before working.
- [`CMDSPACE.md`](CMDSPACE.md) — the authoritative living architecture doc.
- [`docs/architecture/design-patterns.md`](docs/architecture/design-patterns.md)
  — mandatory pattern contract. Before coding, identify the applicable pattern
  seam and preserve its invariants; report affected patterns and verification.

## cmdSpace Project Guidance

### Design pattern contract

All coding agents MUST follow
[`docs/architecture/design-patterns.md`](docs/architecture/design-patterns.md)
for every applicable change. Reuse its existing seams and sources of truth.
Do not introduce, remove, or bypass an architectural pattern or invariant
without documenting the reason and updating an ADR when the decision is
durable. “100% follow” applies to applicable code; it does not justify forcing
an unrelated pattern into a simple implementation.

- The desktop app is React 19 + Vite + TypeScript under `src/`; native and
  privileged behavior lives in the Tauri/Rust crate under `src-tauri/`. Keep
  Tauri command contracts synchronized across both layers.
- Start product changes from the owning module in `src/modules/`. `src/app/App.tsx`
  coordinates workspace, tab, and pane persistence; do not duplicate that
  state in feature components.
- Standard terminals use `src/modules/terminal/`; canvas terminals use their
  own PTY lifecycle in `src/modules/architecture/CanvasTerminalNode.tsx`.
  Do not route canvas terminals through `TerminalPane`, the shared renderer
  pool, or existing terminal-pane sessions.
- Preserve terminal resource lifecycle: opening creates the PTY, closing a
  terminal or clearing its canvas closes it, and saved canvas state contains
  layout metadata only—not a live terminal session.
- Keep canvas camera transforms separate from terminal layout. Camera zoom and
  pan should transform the terminal world as a layer; do not trigger xterm fit
  or PTY resize on every camera tick. During interactive terminal resizing,
  batch UI updates and defer terminal fitting until the resize settles.
- For frontend changes, run focused Vitest coverage and `pnpm build`. For
  changes in `src-tauri/`, also run `cd src-tauri && cargo check --all-targets --locked`;
  run `cargo clippy --all-targets --locked -- -D warnings` when practical.
- Use the existing Tauri bridge and terminal helpers (`invoke`, `pty-bridge`,
  OSC handlers, and macOS IME bridge) instead of creating parallel IPC or
  terminal input paths.

<!-- HARNESS:BEGIN -->
## Harness

Start with the requested outcome, then use the repository as the system of
record. Read `docs/WORKFLOW.md` and only relevant product, design, plan, code,
and validation material.

- Answers, explanations, reviews, diagnoses, plans, and status reports are
  read-only. Inspect only what is needed and do not mutate repository or Harness
  state.
- For a bounded change, use an ephemeral plan: inspect the affected behavior and
  proof, implement, and validate. No control-plane operation is required.
- Create or update one file under `docs/plans/active/` when work spans sessions,
  needs coordination, has meaningful dependencies, or requires recovery steps.
  Move it to `docs/plans/completed/` only after validation.
- Before editing, identify repository authority for each new externally
  observable policy. If materially different choices remain open, stop before
  edits; configurable defaults are not authority.
- Report reusable agent friction. Change guidance, tools, runbooks, or validation
  for that purpose only when explicitly asked to use `$improve-harness`.
- Also pause when product intent remains ambiguous, recovery is difficult,
  validation is weakened, or authority is insufficient.
- Claim completion only with relevant executable or observable evidence. Report
  the outcome, important changes, validation, and unresolved risks.

SQLite intake, story, trace, scoring, audit, and proposal commands are optional
compatibility features. Use them only when explicitly requested or required by
an external orchestrator.
<!-- HARNESS:END -->

## Code Search

Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:

​```bash
semble search "authentication flow" ./my-project
semble search "save_pretrained" ./my-project
semble search "save model to disk" ./my-project --top-k 10
​```

If you anticipate doing more than one search, use `semble index` to create an index.

​```bash
semble index ./my-project -o my_index
​```

You can then reuse this index later on:

​```bash
semble search "save_pretrained" --index my_index
​```

An index is not automatically updated, so if the code changes significantly, reindex. If you notice stale results while resolving searches to files, reindex.

Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:

​```bash
semble search "deployment guide" ./my-project --content docs
semble search "database host port" ./my-project --content config
semble search "authentication" ./my-project --content all
​```

Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):

​```bash
semble find-related src/auth.py 42 ./my-project
​```

Like search, `find-related` also accepts an `--index` argument.

`path` defaults to the current directory when omitted; git URLs are accepted.

If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

### Workflow

1. Index the repo using `semble index -o cached_index`.
2. Start with `semble search` to find relevant chunks. Pass the index to achieve results faster.
3. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
4. Inspect full files only when the returned chunk does not give enough context.
5. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
6. Use grep only when you need exhaustive literal matches or quick confirmation of an exact string.

## Project Skills

Project-local skills live under `.agents/skills/`. When a user request matches a skill below, read that skill's `SKILL.md` before planning or editing, then follow only the relevant parts. If multiple skills apply, use the smallest set that covers the task.

- `ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/SKILL.md`) — Use for UI/UX design, component creation or refactoring, responsive behavior, accessibility, typography, color systems, visual polish, interaction states, charts, dashboards, landing pages, SaaS/admin/product screens, and UI quality reviews.
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`) — Use when asked to review UI, audit design, check accessibility, review UX, or check web code against interface guidelines. Fetch the latest guidelines from the URL specified in the skill before producing findings.
- `rust-best-practices` (`.agents/skills/rust-best-practices/SKILL.md`) — Use when writing, reviewing, refactoring, testing, documenting, or optimizing Rust code, especially around ownership, borrowing, cloning, `Result` error handling, performance, Clippy, and idiomatic API design.
- `memory-safety-patterns` (`.agents/skills/memory-safety-patterns/SKILL.md`) — Use when writing safe systems code, managing resources, preventing memory bugs, implementing RAII/ownership/smart-pointer patterns, or debugging leaks, use-after-free, double-free, buffer overflow, dangling pointer, or data-race issues.
- `performance-profiling` (`.agents/skills/performance-profiling/SKILL.md`) — Use when measuring, profiling, analyzing, or optimizing performance; establish a baseline first, identify bottlenecks with appropriate tools, make targeted changes, and validate improvements.
- `tauri-v2` (`.agents/skills/tauri-v2/SKILL.md`) — Use for Tauri v2 work: `src-tauri`, `tauri.conf.json`, Rust commands, `invoke`/IPC, events/channels, permissions/capabilities, plugins, updater/distribution, desktop/mobile builds, and Tauri troubleshooting.
- `karpathy-guidelines` (`.agents/skills/karpathy-guidelines/SKILL.md`) — Use when writing, reviewing, or refactoring code to keep changes simple, surgical, assumption-aware, and verifiable.

### Skill Usage Rules

1. Load the relevant `SKILL.md` first; do not rely on memory for skill-specific instructions.
2. Resolve relative references inside a skill from that skill's directory, for example `.agents/skills/tauri-v2/references/...`.
3. Keep context tight: read only the sections or referenced files needed for the current task.
4. Skill instructions complement this file. If instructions conflict, direct user/developer instructions win, then this `AGENTS.md`, then the skill.
