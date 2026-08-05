# ADR 0002: Terminal Renderer Pool — Rebind, Don't Recreate

Status: accepted
Date: 2026-08-05

## Context

A terminal tab can contain many split panes, and switching between them happens
constantly. Creating and destroying an xterm instance per switch is expensive:
each instance allocates a renderer, addons, and a WebGL context, and the PTY's
scrollback must be replayed on every remount. Naive per-pane xterm instances
also made pane switching visibly janky.

## Decision

Maintain a **fixed pool of up to 12 xterm instances** (`POOL_MAX_SIZE`) in an
off-screen recycler (`src/modules/terminal/lib/rendererPool.ts`). Switching
panes **rebinds** an existing terminal: the released pane's scrollback is
snapshot via `SerializeAddon` and stored, the incoming pane's snapshot is
written back, and any output that arrived while the pane was hidden is replayed
from the session's dormant ring. Alt-screen TUIs get a SIGWINCH `kickPty` bump
so they repaint from scratch instead of replaying incoherent cursor updates.

Sessions themselves live at module level (`Map<leafId, Session>` in
`useTerminalSession.ts`) and survive React remounts.

## Consequences

- Pane switching is cheap — no xterm create/destroy on the hot path.
- Scrollback survives rebinds (snapshot + dormant ring).
- Pool sizing matters: >12 live panes evict the least-recently-used slot.
- The pool is shared by standard terminals only; canvas terminals are exempt
  (see ADR 0003's companion — canvas nodes own private instances).

## Rejected Alternatives

- One xterm per pane, created on mount and destroyed on unmount — rejected:
  expensive and caused visible jank on split-heavy workspaces.
- Recreating xterm per switch with full scrollback replay — same cost problem.

## Verification

- `rendererPool.source.test.ts` asserts pool constants and rebind semantics.
- Perf-sensitive switching is manually verified on split-heavy tabs.
- Pool size and eviction are covered by `POOL_MAX_SIZE` source assertions.
