# Architecture and Scale Readiness

Updated: 2026-08-31

## Scope

This document records the current architectural assessment of cmdSpace after
the active decomposition work. It is a decision aid for future refactors; it
does not replace `CMDSPACE.md`, `docs/architecture/design-patterns.md`, or the
module-specific plans.

The assessment distinguishes three meanings of scale:

1. **Feature scale:** adding more terminal, AI, editor, workspace, and remote
   capabilities without duplicating ownership.
2. **Runtime scale:** keeping PTY, provider, renderer, memory, and network
   resources bounded inside one desktop process.
3. **Team scale:** allowing several contributors or agents to change adjacent
   seams without breaking contracts or creating merge ambiguity.

cmdSpace is intentionally a desktop application. Horizontal server scaling is
not a product requirement for the embedded remote server; modularity,
resource bounds, recovery, and protocol compatibility are the relevant goals.

## Current verdict

### Pattern discipline: strong

The repository uses patterns where they hide real complexity:

| Pattern | Current seam | Invariant protected |
|---|---|---|
| Bridge | React/Tauri `invoke`, xterm/PTY bridge | Privileged operations do not bypass Rust; terminal transport stays explicit |
| Adapter / Strategy | Agent provider adapters and platform shell/speech branches | Provider and OS quirks stay behind stable event and command shapes |
| Facade | `App.tsx`, `native.ts`, `db.rs`, `remote.rs`, `commands.rs` | Callers use a narrow workflow surface instead of reimplementing coordination |
| Composite / State | Pane trees, tagged tabs, canvas dock groups | Recursive structure and lifecycle transitions remain explicit |
| Flyweight | Renderer pool | xterm instances are reused and bounded rather than recreated per switch |
| Observer | PTY channels, Tauri events, Git events, Zustand | Subscribers detach with their owner and events do not become a second source of truth |
| Proxy | Workspace authorization, AI HTTP security, keychain access | Authorization and SSRF/path policy cannot be skipped by a frontend caller |
| Memento | Canvas history and workspace layout persistence | Snapshots contain serializable metadata, never live processes or PTYs |
| Command | Tauri commands, shortcuts, Git actions, approved AI tools | Input, approval, execution, and cleanup remain observable operations |

This is pattern use with architectural intent, not pattern-name decoration.
The repository contract is documented in
[`design-patterns.md`](design-patterns.md).

### Feature scale: good, with a few remaining mixed seams

The decomposition has already moved most policy clusters into focused modules:
Agent Chat providers/parsers, remote access, database queries, Git operations,
PTY/session lifecycle, canvas interactions, workspace setup, source control,
explorer actions, and renderer lifecycle.

The remaining production seams with the clearest decomposition or validation
value are:

1. Architecture Canvas source-contract debt — focused passes moved frame,
   text, edge, connector, placement state (`canvasPlacementStateModel`), and
   terminal focus navigation (`canvasTerminalFocusModel`) into direct model proof.
   `ArchitectureCanvas.tsx` retains coordinator/facade ownership.
2. Windows/WSL shell and native-speech behavior — host-neutral lifecycle tests
   now fence stale speech events, but Windows/MSVC compile and smoke evidence
   must come from a real target environment.
3. Bundled macOS speech — the lifecycle is now direct-tested, but microphone,
   Bluetooth-route retry, and final-result behavior still require a packaged
   app smoke test.

`App.tsx`, `ArchitectureCanvas.tsx`, and `useTabs.ts` are intentionally still
coordinators/owners. Their size alone is not evidence that ownership should
move. The deletion test is whether removing a proposed module would spread
state and lifecycle complexity across callers.

### Runtime scale: bounded and safe for a desktop process

Current bounds include:

- renderer pool capacity: 12 slots;
- terminal snapshot scrollback cap: 5,000 lines;
- Agent Chat replay tail: 128 events;
- Agent Chat detached-runtime grace period: 15 minutes;
- one-shot shell timeout: 1–300 seconds;
- one-shot shell output cap: 256 KiB;
- explicit PTY/provider close, detach, reaper, and stale-subscriber paths.

These limits show deliberate resource thinking. The main scale constraints are
global/process-local state and concurrency policy:

- renderer/session registries are process-local singletons;
- Agent Chat currently uses a global start gate to prevent duplicate provider
  processes (`runtime.rs` / `session_commands.rs`);
- `AgentChatEventSink` stores one current UI channel and replaces it on attach,
  which is correct for one active UI subscriber but not a multi-view broadcast
  contract.

These are acceptable for the current desktop surface. A future multi-window or
multi-client requirement must decide whether the contract remains single-owner
or becomes a subscriber registry before changing the implementation.

### Team scale: the largest current weakness

The frontend and Rust layers duplicate parts of the IPC contract manually:
command names and payloads are registered in Rust while DTOs and invocations
are declared in TypeScript. Source-contract tests protect important seams, but
they are sensitive to file movement. The current worktree also contains a
large, multi-agent dirty diff, so integration boundaries are harder to review
than the individual modules.

The next team-scale improvements should therefore prioritize:

- one canonical inventory for Tauri command names, payloads, and ownership;
- behavior/contract fixtures at lifecycle and protocol boundaries;
- versioned SQLite migration intent rather than indefinite column probing;
- platform CI or reproducible native validation for Windows/WSL and macOS
  speech;
- explicit change-group ownership before staging or committing a multi-agent
  worktree.

## Senior-level signals already present

- Privilege is concentrated at the native boundary.
- Resource ownership has explicit close/dispose symmetry.
- Persisted state excludes live handles and process objects.
- Provider/platform differences are isolated behind adapters.
- Security checks live at the point where paths, hosts, and secrets cross a
  trust boundary.
- Bounded buffers, timeouts, replay tails, and reapers make failure behavior
  observable instead of unbounded.
- Refactors preserve compatibility facades and add focused regression tests.

## Gaps to close before calling the architecture production-scale

1. **Contract automation:** reduce manual TypeScript/Rust IPC drift.
2. **Behavior coverage:** retain direct lifecycle coverage for voice capture,
   import-dialog state, Agent Chat provider exit, and platform cleanup; use
   source tests only for structural invariants and add target-host smoke tests.
3. **Migration discipline:** introduce explicit schema-version progression and
   old-schema fixtures before the database gains more durable fields.
4. **Concurrency policy:** retain the global Agent Chat start gate until real
   cold/warm measurements justify a narrower policy; evolve the tokenless
   detach contract before introducing multi-view subscriber semantics.
5. **Native validation:** compile and exercise Windows/WSL shell paths and the
   macOS audio-engine lifecycle on their target platforms.
6. **Integration hygiene:** partition the current dirty worktree into coherent,
   independently verifiable change groups.

## Non-goals

- Do not split files solely to reduce line count.
- Do not move tab/workspace/pane ownership out of `App.tsx`/`useTabs` without a
  new source-of-truth decision.
- Do not refactor generated icon/provider catalogs as if they were logic.
- Do not add a dependency only to generate a thin wrapper around existing
  command contracts.
- Do not introduce horizontal remote-server architecture unless the product
  scope explicitly changes from embedded desktop access.

## Evidence references

- [`CMDSPACE.md`](../../CMDSPACE.md) — product and runtime architecture.
- [`design-patterns.md`](design-patterns.md) — pattern and invariant contract.
- [`phase-1-boundaries.md`](phase-1-boundaries.md) — ownership/seam registry.
- [`REFACTOR_ROADMAP.md`](../REFACTOR_ROADMAP.md) — decomposition status and
  remaining platform/test gaps.
- [`2026-08-31-architecture-scale-hardening.md`](../plans/active/2026-08-31-architecture-scale-hardening.md)
  — execution plan for closing the gaps above.
