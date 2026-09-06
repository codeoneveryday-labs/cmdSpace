# Multi-Agent Teamwork

Several agents share this tree concurrently. These lanes and habits keep everyone unblocked.

## Lanes

- **BE orchestration** (`orchestration/*.rs`): pure modules + additive commands. No behavior changes to others' paths without talking first.
- **Panel / catalog / worker-start** (`OrchestrationCanvasPanel.tsx`, `cliAgents.ts`, setup flow, toolbar): canvas-agent's lane. Read it, don't refactor under them.
- **PTY / agent_chat internals**: their owners' lanes. Propose seams (e.g. timestamp, hook bridge), don't seize files.

## Dirty-tree etiquette

1. `git status` before editing; know whose hunks neighbor yours.
2. Additive edits only in shared files (new functions, new registrations, new branches). Never reformat, rename, or "improve" adjacent code.
3. New files beat edits to hot files. New modules are `pub(crate)` unless IPC needs them.
4. Repair what you break the same turn — including tests owned by others that your change invalidates (e.g. type migrations).
5. `cargo fmt` touches the whole tree: prefer `--check` first; if you must write, confirm no unrelated hunks appear.

## Coordination

- One execution plan per workstream in `docs/plans/active/` (template `docs/templates/exec-plan.md`): outcome, scope, decisions, validation. Record cross-agent collisions and their resolutions there.
- Big overlaps (same file, same sprint): merge, don't duplicate. One writer per path — reconcile renderers, keep both sides' tests passing.
- FE/BE contracts: match field names exactly (camelCase over IPC); changing a command signature means updating every caller the same turn.

## Review checklist (from real incidents)

1. Resume/retry paths re-admit, or runs stall with everything Queued.
2. Prepare/retry/sync helpers are idempotent — re-runs must be no-ops, not errors.
3. No `unwrap`/`expect` outside tests; no `panic!` in commands.
4. Clippy `-D warnings` clean; no `#[allow]` without the repo-precedent reason.
5. Docs promise only what mechanics do (e.g. "automatic delivery" must be wired, not aspirational).
