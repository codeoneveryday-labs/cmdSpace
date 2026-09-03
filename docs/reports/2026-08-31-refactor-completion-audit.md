# Refactor Completion Audit

Recorded: 2026-08-31; updated: 2026-09-01

## Verified completed seams

| Area | Evidence |
|---|---|
| Tauri contract | Static frontend command/payload fixture plus command registry coverage; the frontend CI job runs the full test suite. |
| Remote backend | Facade/deep-module split with HTTP, WebSocket, session, auth, provider and device seams. |
| Voice | Direct models for capture transition, browser capture cleanup, listener cleanup, literal transcript insertion, and Agent Chat draft composition. |
| Window surfaces | Command-compatible facade with focused launch, settings, blur, webview and tray seams. |
| Explorer | Pure path/state/mutation policies with injected native port, plus directory response fencing so stale reads cannot overwrite a newer refresh or root. |
| Database | In-memory schema initialization seam and idempotent legacy workspace/pane upgrade fixture. |
| Terminal | Pane drag lifecycle, pane render projection, and keyboard edit/copy shortcut policies. |
| Agent Chat | First-prompt admission, provider-exit cleanup, bounded replay, stale-channel cleanup, token-bound detach, reaper/close tests. |
| Canvas proof | Frame attachment, text sizing, edge overlap, and connector endpoint behavior have direct model proof; source contracts retain composition/UI ownership. |
| Native speech | Request/session lifecycle fences stale macOS callbacks and buffered Windows process output without changing speech command or event payload shapes. |
| Import sessions | Pure provider/session projection with a controller-state normalization regression test for disabled/re-enabled providers. |

## Verification snapshot

- Frontend: `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` pass in
  the current worktree. The most recent frontend run reported 456 test files,
  1,178 tests, and 6 relay tests.
- Native: `cargo fmt --all -- --check`, `cargo check --all-targets --locked`,
  `cargo clippy --all-targets --locked -- -D warnings`, and
  `cargo test --all-targets --locked` pass. The most recent Rust run reported
  287 passed tests and 2 explicit live-CLI tests ignored.
- `git diff --check` passes.

## Deliberately open work

| Item | Why it remains open | Required evidence or decision |
|---|---|---|
| Agent Chat concurrency policy | Global start gate correctly prevents duplicate provider processes, but changing it requires real cold/warm data. | Observe `lastColdStartMs` / `lastWarmAttachMs` from actual provider runs. |
| Windows / WSL validation | Host macOS cannot compile Windows C dependencies without the Windows SDK toolchain. | Windows/MSVC target check and WSL shell smoke test. |
| macOS native speech | Unit/source coverage cannot prove microphone permission and audio-engine lifecycle in a bundled app. | Bundled-app microphone/audio smoke test. |
| Explorer shallow wrappers | `FileExplorerHeader.tsx` and `FileExplorerRow.tsx` are presentation wrappers; removal requires deleting or inlining files. | Explicit written permission to delete files, then a focused behavior-preserving change. |
| Migration strategy | Current upgrades are additive/idempotent column probing; an explicit version baseline or non-additive migration would change durable-data recovery semantics. | ADR defining historical baseline, recovery, and first non-additive boundary. |
| Change-group delivery | The shared worktree remains large and multi-owner; staging/committing now would mix unrelated work. | Re-run ownership review against the final intended delivery set before any stage/commit. |

## Integration ownership snapshot — 2026-09-01

The worktree contains 865 changed or untracked paths. This is an inventory
only—nothing was staged, committed, reset, cleaned, or deleted for it.

| Path ownership group | Paths |
|---|---:|
| App, canvas, terminal, tabs | 435 |
| Workspace, explorer, settings, filesystem, Git, PTY, database | 199 |
| Agent Chat and AI | 105 |
| Remote | 50 |
| Docs and CI | 14 |
| Other | 62 |

The grouping is path-based, so delivery still needs a line-level ownership
review for the precise files selected for each commit. It is intentionally not
permission to stage any of the shared worktree.

## Non-goals

- Do not split `App.tsx`, `ArchitectureCanvas.tsx`, or `useTabs.ts` merely for
  file size: they remain intentional ownership coordinators.
- Do not introduce a subscriber registry, per-chat start gate, schema version
  system, or external sidecar without the corresponding product decision and
  verification evidence.
