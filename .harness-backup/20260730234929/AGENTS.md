# Agent Instructions

Add project-specific agent instructions here.

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `scripts/bin/harness-cli query matrix` on macOS/Linux, or `.\scripts\bin\harness-cli.exe query matrix` on Windows

Use the Rust Harness CLI at `scripts/bin/harness-cli` on macOS/Linux or
`scripts/bin/harness-cli.exe` on Windows as the main operational tool.
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
