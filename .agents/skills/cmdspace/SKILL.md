---
name: cmdspace
description: "cmdSpace repo work: implementing features, fixing bugs, or reviewing in this Tauri+React codebase. Orchestration canvas runs coordinating CLI workers. Canvas terminal or worker-launch changes. Multi-agent coordination in shared files."
version: 1.1.0
---

# cmdSpace Project Skill

cmdSpace is a terminal-first, AI-native desktop workspace: Tauri 2 + Rust backend, React 19 + xterm.js + CodeMirror 6 frontend. Real PTYs, BYOK AI agents, Canvas mode with live terminal nodes, orchestration runs coordinating CLI workers.

## The one rule

> **The webview never touches FS, processes, or shells. Everything privileged goes through `invoke()` to a Rust command.** Never build a parallel IPC path.

## Steps

1. **Read** — `CMDSPACE.md` first, then only what the task needs: `COMPREHENSIVE_PLAN.md` (maps), `docs/plans/active/` (in-flight work, mandatory before touching shared files), `docs/architecture/design-patterns.md` (seams).
2. **Locate** — feature modules live in `src/modules/<name>/` (barrel `index.ts`); privileged ops live in `src-tauri/src/modules/`. `src/app/App.tsx` only coordinates — never duplicate its state. New commands register in `src-tauri/src/commands.rs`.
3. **Coordinate** — run `git status` first; lanes and etiquette in `references/teamwork.md`. Orchestration semantics in `references/orchestration.md`.
4. **Verify** — done means: focused tests + full checks below all green, others' tests still green, diff contains only the task.

## Reference

- Path alias `@/*` → `src/*`. Frontend canonical paths are forward-slash; split with `/[\\/]/`.
- FE CLI catalog `src/modules/terminal/lib/cliAgents.ts` is the single source of truth for agents. No parallel provider tables in Rust.
- Frontend: `pnpm exec tsc --noEmit`, focused Vitest, `pnpm build`.
- Rust: `cargo test --locked <area>`, `cargo check --all-targets --locked`, `cargo clippy --all-targets --locked -- -D warnings`, `cargo fmt --all -- --check`, `git diff --check`.
- Never `git reset --hard` / `clean -fd` / `rm -rf` without explicit user approval stating they understand. Never delete a file without written permission. Conventional commits (`commit_conventional.md`).
