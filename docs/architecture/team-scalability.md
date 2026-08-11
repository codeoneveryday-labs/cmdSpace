# Team Scalability and Codebase Boundaries

## Context

cmdSpace is now a medium-to-large desktop application rather than a small
single-surface UI. The current architecture is sound, but several files act as
coordination hubs. Those hubs increase merge conflicts, review cost, and the
chance that a local change breaks an unrelated flow.

The goal is to make parallel development safer without rewriting the product
or introducing a new framework.

## Current shape

- Frontend: React 19 + TypeScript + Vite.
- Native layer: Tauri 2 + Rust.
- Terminal: PTY sessions, xterm renderer pool, OSC integration, and pane trees.
- AI: providers, sessions, tools, approvals, voice, and live terminal context.
- Persistence: SQLite for durable workspace/pane state, stores for preferences
  and AI sessions, OS keychain for secrets.

The most important architectural rule remains:

> The webview does not access files, processes, or shells directly. Privileged
> behavior crosses the typed Tauri command boundary.

## Main risks when more people contribute

### 1. Large coordination hubs

The most likely conflict points are:

- `src/app/App.tsx`
- `src/modules/architecture/ArchitectureCanvas.tsx`
- `src/modules/terminal/TerminalStack.tsx`
- `src-tauri/src/lib.rs`

These files currently combine wiring with behavior. They should become thinner
over time, but they should not be rewritten in one large refactor.

### 2. Cross-module state ownership

Workspace, tabs, panes, terminal sessions, persistence, and UI chrome are
connected. A feature becomes risky when it adds state to `App.tsx` merely
because that is the nearest shared component.

Every piece of state should have one owner and a narrow API for consumers.

### 3. Terminal lifecycle coupling

The terminal subsystem is not an ordinary React component. PTY lifecycle,
renderer pooling, pane hydration, focus, resize, OSC markers, and session
metadata must remain coordinated. Changes in this area need focused tests and
manual smoke testing.

### 4. Native command fan-out

A new privileged feature commonly touches a Rust module, command registration,
capabilities, a frontend bridge, and persistence. These contracts need to be
kept explicit so two contributors do not implement incompatible shapes.

## Target direction

### Keep `App.tsx` as a coordinator

`App.tsx` should compose modules and connect application-level events. Move
behavior into domain hooks or services by responsibility:

- workspace lifecycle and restore;
- tab and pane actions;
- sidebar and window chrome state;
- persistence synchronization;
- global shortcut actions;
- live terminal context for AI.

The result should be that a feature in one domain usually changes that domain
plus a small wiring surface, rather than a large section of `App.tsx`.

### Split the terminal stack by responsibility

Keep the existing lifecycle model, but separate the concerns conceptually and
then physically when a bounded change touches them:

- pane-tree rendering;
- renderer hydration and lazy restore;
- drag/swap interactions;
- terminal bundle and imperative handles;
- session/PTY lifecycle.

Do not route canvas terminals through the standard terminal renderer pool.

### Split the architecture canvas

The canvas should have clear boundaries for:

- camera transform and pointer interaction;
- diagram node/edge editing;
- terminal docking and layout;
- terminal activation/detachment;
- diagram persistence.

The canvas terminal lifecycle must remain separate from standard terminal panes.

### Make native command registration compositional

Keep the single Tauri invoke boundary, but group command registration by
domain. A contributor should be able to add a command under `pty`, `git`,
`workspace`, or `remote` without manually navigating an unstructured list.

The command contract should be documented at the module boundary:

- command name;
- input and output types;
- workspace/security assumptions;
- error behavior;
- required capability changes.

### Establish ownership by subsystem

Recommended ownership areas:

| Area | Primary surfaces |
|---|---|
| Terminal / PTY | `src/modules/terminal`, `src-tauri/src/modules/pty` |
| AI | `src/modules/ai` |
| Canvas | `src/modules/architecture` |
| Editor / explorer | `src/modules/editor`, `src/modules/explorer` |
| Git / source control | `src/modules/git*`, `src/modules/source-control`, Rust git modules |
| Workspace / persistence | `src/modules/workspace`, `src/modules/tabs`, Rust workspace/db modules |
| Remote access | settings remote access and Rust remote modules |
| Release / platform | `src-tauri`, capabilities, CI, release workflow |

Ownership means a primary reviewer and an agreed contract, not exclusive
permission to edit files.

## Recommended sequence

### Phase 1: Make boundaries explicit

- Assign subsystem owners/reviewers.
- Add or maintain a small README for each complex subsystem.
- Record public APIs and state owners before extracting code.
- Keep PRs single-concern and avoid incidental formatting.

### Phase 2: Reduce the biggest hubs incrementally

- Extract one domain hook from `App.tsx` at a time.
- Split `TerminalStack` only when a feature naturally exposes a seam.
- Split canvas layout and camera logic independently.
- Keep behavior locked with focused tests before moving code.

### Phase 3: Strengthen boundary tests

Prioritize tests for behavior that crosses modules:

- pane open/close/swap and persistence;
- PTY attach/detach/rebind;
- workspace restore;
- Tauri command input/output contracts;
- AI approval and session persistence;
- remote start/stop;
- Windows path normalization.

### Phase 4: Improve review routing

- Replace one wildcard CODEOWNERS rule with subsystem ownership.
- Require a terminal/PTY reviewer for terminal lifecycle changes.
- Require a Rust/security reviewer for filesystem, shell, network, or IPC work.
- Require screenshots and manual flow notes for user-visible UI changes.

## Rules for contributors

1. Read the owning module and two adjacent files before editing.
2. Do not add shared state to `App.tsx` unless it is genuinely application-wide.
3. Do not create a second IPC path around the Tauri command boundary.
4. Do not mix cleanup/refactoring with a feature or bug fix.
5. Preserve PTY and renderer lifecycle invariants.
6. Keep public contracts typed and narrow.
7. Add focused tests at the boundary that the change can break.
8. Run the smallest relevant checks locally, then the repository CI checks before delivery.

## Success criteria

This direction is working when:

- most feature PRs touch one subsystem plus small application wiring;
- two contributors can work in different domains without frequent conflicts;
- `App.tsx` and `lib.rs` changes are mostly composition/registration;
- terminal changes have clear lifecycle tests;
- reviewers can identify the owner and security boundary from the file location;
- behavior can be verified without relying only on a full manual app session.

## Non-goals

- Do not rewrite React, Tauri, or the state libraries.
- Do not split the application into services or packages prematurely.
- Do not move code solely to reduce line count.
- Do not trade terminal lifecycle correctness for more superficial modularity.

## Source references

- `CMDSPACE.md` — living architecture and invariants.
- `COMPREHENSIVE_PLAN.md` — module and command map.
- `docs/architecture/terminal-input-pipeline.md` — terminal input boundary.
- `docs/adr/0001-two-process-model.md` — frontend/native boundary.
- `docs/adr/0002-terminal-renderer-pool.md` — renderer lifecycle.
- `CONTRIBUTING.md` — contribution and review expectations.
