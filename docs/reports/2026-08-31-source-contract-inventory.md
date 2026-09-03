# Phase 1 Source-Contract Inventory

Recorded: 2026-08-31

## Baseline

- 275 `*.source.test.ts(x)` files under `src/`.
- 2,901 assertions currently inspect source strings (`toContain`,
  `not.toContain`, or `toMatch`). This includes focused source contracts added
  during the active worktree refactors; it is not directly comparable to the
  original baseline count.
- The largest files are architecture/canvas, voice/AI, terminal renderer, and
  settings/remote source contracts. They are structural evidence, not a
  substitute for lifecycle behavior tests.

## Classification policy

| Class | Keep as source contract | Move to direct proof |
| --- | --- | --- |
| Structural invariant | Yes: command registration, ownership boundaries, platform guards, forbidden native bypasses | Only when a testable model/hook exposes the same invariant directly |
| Wire contract | Yes: Tauri command name, parameter casing, event/topic names, protocol/version tags | Add Rust/TypeScript fixture or protocol round-trip where a natural seam exists |
| Behavior claim | No as the final proof: rendered labels, fallback branches, lifecycle order, cleanup, selection, or mutation results | Model, hook, render, Rust unit, or integration test at the owning seam |

## Current hardening results

- `src/lib/tauriCommandRegistry.contract.test.ts` is the canonical name/payload
  fixture. It scans production static `invoke` calls and verifies that every
  command is registered by `cmdspace_commands!` and every static payload key
  maps to its Rust command parameter after camel/snake normalization.
- The fixture intentionally retains structural proof only. It does not parse
  dynamic payload construction or try to duplicate Rust serialization in a
  JavaScript parser.

## Priority behavior migrations

1. Voice capture: lifecycle is completed with direct `voiceCaptureModel`,
   `voiceCloudCapture`, and `voiceCaptureListeners` tests. Transcript
   insertion now also has direct missing-target/busy/success/error coverage in
   `voiceTranscriptInsertionModel`; retain only UI/platform ownership source
   contracts.
2. Agent Chat composer: `appendVoiceTranscript` now has direct prompt-model
   tests. The former `AgentChatWorkspace` cross-file source aggregator was
   reduced from 107 implementation assertions to 11 ownership assertions.
3. Explorer tree and import dialog: completed for this hardening slice.
   Path/reset/refetch policy and mutation ordering have direct coverage, while
   existing selection, drag/drop and import-session models retain their tests.
4. Agent runtime: direct Rust tests now cover deterministic concurrent start,
   replay ordering, stale delivery cleanup, detach without kill, explicit
   close, and idle reaping. Frontend startup tests cover background resident
   attach, first-prompt cold admission, warm reuse, and retry after a failed
   cold start; retain hook source contracts only for React ownership.
5. Platform adapters: macOS speech request/session ownership now has direct
   lifecycle tests for start replacement, stale-result suppression, request
   invalidation, and completed-session release. Retain `cfg`/registration
   assertions; Windows/WSL target evidence remains outstanding.
6. Remote session UI: `remoteSessionLifecycleModel` now directly covers CWD
   matching, active-session fallback, and retry bounds; retain the UI source
   test only for transport and composition ownership.
7. Native device pairing: `buildNativeDevicePairingUrl` directly covers deep
   link query encoding; retain Settings source checks only for pairing UI
   ownership and remote command wiring.
8. Native autostart: `autostartPreferenceAdapter` directly covers
   synchronization, unmount cancellation, toggle ordering, and failure
   handling; retain the Settings source test only for visible preference
   wiring.
9. Terminal pane drag: `useTerminalPaneDrag` owns pointer/cancel/swap
   lifecycle behind a stable drag context. The remaining tree source test
   checks the header/view ownership while direct geometry tests cover its pure
   projection rule.
10. Terminal render state: `getTerminalPaneRenderState` directly covers
    normal/maximized/no-tab projection while preserving leaf persistence
    metadata; `TerminalStack` retains React/renderer coordination.
11. Terminal input shortcuts: `terminalInputShortcuts` directly covers edit
    and copy chord policy; retain renderer source tests only for xterm/PTY,
    clipboard, and composition adapter ownership.
12. Terminal renderer lifecycle: `rendererSlotLifecycle.test.ts` directly
   covers standard-slot snapshot/ring replay, alt-screen ring discard with
   PTY repaint, PTY resize, search setup, and detach cleanup of OSC
   subscriptions, resize work, auto-copy state, host, and live leaf identity.
   Retain `rendererPool.source.test.ts` for pool cap, renderer ownership,
   input-path boundaries, and CSS/platform invariants.
   `rendererResize.test.ts` directly covers paused chrome resize deferral,
   the one-time fit/refresh/PTY resize on resume, and repaint without a PTY
   resize when host dimensions change but terminal rows/cols do not. Those
   replace the corresponding source-string assertions.
13. Terminal session exit policy: `resolveTerminalExitDisposition` directly
    covers the `notify`, `defer`, and respawn `suppress` outcomes, replacing
    the source assertion that depended on the former inline runtime branch.
14. Terminal selection copy: `rendererInput.test.ts` directly covers debounce,
    duplicate suppression, clipboard success with accessible copied feedback
    and selection cleanup, plus clipboard failure without selection loss.
    This replaces the renderer source assertions that read those internals.
15. Terminal OSC filtering: the same interaction test now proves xterm's OSC
    10/11 color reports do not reach the PTY write bridge, replacing the
    source-string guard assertion.
16. Terminal command observation: the renderer input interaction test proves
    the visible prompt line is observed before the Enter bytes are forwarded
    to the PTY, replacing the ordering assertion over implementation strings.
17. Terminal key maps: `keymap.test.mjs` imports the actual pure functions
    rather than evaluating their source text, while the renderer input test
    proves Cmd+Shift+Arrow reaches the PTY before pane-navigation handling.
18. Canvas terminal selection copy: direct selection-copy and shortcut tests
    cover debounce, latest-selection copy, success cleanup, badge expiry, and
    platform copy mapping. The Canvas source contract now retains only its
    isolated-PTY and UI ownership invariants.
19. Remote bootstrap URL: `remoteBootstrapUrl` directly covers path/query/hash
    secret precedence and URL scrubbing; retain the password screen source
    test only for UI/history adapter ownership.
20. Remote folder picker: `remoteFolderPickerModel` directly covers normalized
    search, folder/file filtering, and empty-state policy; retain the picker
    source contract for fetch/cache/cancellation/navigation ownership.

## Integration status

The contract fixture passes. Full revalidation on 2026-08-31 passes:
`pnpm exec tsc --noEmit`, `pnpm test` (1,160 frontend tests plus 6 relay
tests), `pnpm build`, Rust `cargo fmt`/check/Clippy, `cargo test --all-targets`
(277 passed, 2 live CLI tests ignored), and `git diff --check`.

## Worktree refactor checkpoint

Snapshot after the terminal behavior-proof slice: 844 changed or untracked
paths. This is an ownership snapshot, not a staging instruction: no files were
staged, committed, reset, cleaned, or deleted by this work.

| Ownership area | Paths |
| --- | ---: |
| Terminal and canvas | 251 |
| App, workspace, and tabs | 237 |
| Feature surfaces | 122 |
| Other native modules and crates | 110 |
| AI frontend | 69 |
| Agent Chat native | 36 |
| Docs and config | 11 |
| Other | 8 |

- The existing deletion of `src/modules/ai/lib/agentChatHistory.ts` remains
  outside this slice and was not touched.
- The terminal behavior-proof slice added direct slot bind/detach/alt-screen,
  resize-pause/repaint, and PTY-exit-policy tests. It removed only the source
  assertions now covered by those direct tests; no test file was deleted.
- Latest validation: 451 frontend test files / 1,160 tests; relay 6/6;
  production build; Rust fmt/check/Clippy; 52 focused Agent Chat tests (2
  real-CLI tests intentionally ignored); and `git diff --check` all passed.
- The production build still reports the known 2.23 MB minified App chunk
  (449 KB gzip). It is deliberately a separately measured performance item,
  not part of this cleanup slice.

## Current ownership snapshot

After the macOS speech lifecycle slice, the shared worktree contains 848
changed or untracked paths. This refresh supersedes the earlier count for
staging decisions only; it does not retroactively change the terminal-slice
snapshot above.

| Ownership area | Paths |
| --- | ---: |
| Terminal and canvas | 253 |
| App, workspace, and tabs | 237 |
| Feature surfaces | 122 |
| Other native modules and crates | 111 |
| AI frontend | 69 |
| Agent Chat native | 36 |
| Docs and config | 12 |
| Other | 8 |

The existing deletion of `src/modules/ai/lib/agentChatHistory.ts` remains
unowned by this slice. No staging or commit is safe until each chosen path is
reviewed against the ownership map at staging time.
