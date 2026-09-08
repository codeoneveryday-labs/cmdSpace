# DESIGN PATTERNS — cmdSpace

**cmdSpace — pattern map and coding contract.** This document names the
architectural patterns already used by the app, the invariants they protect,
and the rules coding agents must follow when changing them.

> This is a practical map, not a catalogue of classes. A pattern earns its
> place when it creates a real seam, hides meaningful complexity, and has a
> behavior that can be verified.

---

## Table of Contents

1. [Reading guide](#1-reading-guide)
2. [Executive summary](#2-executive-summary)
3. [Pattern architecture at a glance](#3-pattern-architecture-at-a-glance)
4. [Active pattern map](#4-active-pattern-map)
5. [Conditional and deferred patterns](#5-conditional-and-deferred-patterns)
6. [Non-negotiable invariants](#6-non-negotiable-invariants)
7. [How to add a feature](#7-how-to-add-a-feature)
8. [How to refactor a pattern seam](#8-how-to-refactor-a-pattern-seam)
9. [How to debug](#9-how-to-debug)
10. [Verification](#10-verification)
11. [Known gotchas](#11-known-gotchas)

---

## 1. Reading guide

Read this document before changing architecture, lifecycle, cross-module
coordination, terminal behavior, AI providers, persistence, or native IPC.

Sources of truth, in priority order:

- [`CMDSPACE.md`](../../CMDSPACE.md) — authoritative architecture and product
  invariants.
- [`COMPREHENSIVE_PLAN.md`](../../COMPREHENSIVE_PLAN.md) — module map,
  persistence model, terminal rules, and delivery checks.
- [`docs/WORKFLOW.md`](../WORKFLOW.md) — read-only, bounded-change, and
  durable-change workflow.
- [`docs/adr/`](../adr/) — accepted architecture decisions.
- [`terminal-input-pipeline.md`](terminal-input-pipeline.md) — PTY, IME, OSC,
  and terminal input contracts.
- [`ROADMAP.md`](../../ROADMAP.md) — product scope and deferred capabilities.
- [23 design patterns for vibe coders](https://arealisticdreamer.com/design-patterns-23-cho-vibe-coder)
  — vocabulary and recognition guide.

The article is a reference, not a requirement to force all 23 patterns into
the codebase. This document is the repository-specific contract.

---

## 2. Executive summary

The current codebase has **14 active patterns**, **4 conditional patterns**,
and **5 patterns with no current architectural role**.

The patterns that shape cmdSpace most strongly are:

- **Bridge** — separates React/webview from Rust/native capabilities and
  separates xterm rendering from PTY ownership.
- **Adapter** — translates provider-specific agent protocols and platform
  behavior into stable app contracts.
- **Facade** — keeps `App.tsx`, native clients, and remote coordination from
  leaking subsystem details into every caller.
- **Composite** — models terminal panes and canvas docking as trees.
- **Flyweight** — reuses a bounded xterm renderer pool.
- **Observer** — distributes PTY, Tauri, DOM, and Zustand events.
- **Strategy** — selects provider, model discovery, and platform behavior.
- **State** — makes tab, terminal, workspace, and agent runtime states explicit.
- **Command** — represents Tauri commands, shortcuts, AI tools, and git actions
  as invokable operations.

“Mandatory” means an applicable change must preserve the relevant pattern and
its invariant. It does not mean a simple function needs a new abstraction just
to receive a pattern name.

---

## 3. Pattern architecture at a glance

```text
┌────────────────────────────── React webview ──────────────────────────────┐
│ App.tsx / WorkspaceSurface                                                 │
│   ├── Mediator + Facade: workspace, tabs, pane and feature coordination     │
│   ├── State: tagged tab kinds and UI lifecycle                             │
│   ├── Composite: pane tree and canvas diagram                              │
│   ├── Command: shortcuts and AI tool actions                               │
│   └── Observer: Zustand, DOM and Tauri event subscriptions                  │
│                                                                            │
│ Bridge: invoke(), Channel, pty-bridge, remote protocol                     │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   ▼
┌────────────────────────────── Rust backend ───────────────────────────────┐
│ lib.rs / commands.rs                                                       │
│   ├── Facade: grouped native command surface                               │
│   ├── Adapter + Strategy: agent providers and shell/platform behavior      │
│   ├── Proxy: authorization, secrets and AI HTTP controls                   │
│   ├── Singleton: managed process-scoped runtime state                     │
│   ├── State: PTY and resident agent lifecycle                              │
│   └── Memento: persisted workspace/pane metadata                           │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   ▼
                 OS processes · filesystem · keychain · network
```

The pattern map follows the same two-process rule as the rest of the project:
the webview never touches filesystem, processes, shells, or secrets directly.

---

## 4. Active pattern map

These patterns are part of the current architecture. Changes in their areas
must preserve the listed interface and invariant.

| Pattern | cmdSpace seam | Invariant | Key locations |
|---|---|---|---|
| Simple Factory | Tab creation and provider profile lookup | Defaults and creation rules stay centralized | `src/modules/tabs/lib/tabFactories.ts`, `src-tauri/src/modules/agent_chat/providers/mod.rs` |
| Singleton | Process-scoped Tauri state, PTY/session registries, renderer pool | Share only genuinely process-scoped resources; every resource still has explicit cleanup | `src-tauri/src/lib.rs`, `useTerminalSession.ts`, `rendererPool.ts` |
| Adapter | Agent protocols and native/platform differences | Provider and platform quirks stay behind a stable common interface/event shape | `src-tauri/src/modules/agent_chat/adapter.rs`, `src/modules/ai/lib/native.ts` |
| Bridge | React ↔ Rust, xterm ↔ PTY, desktop ↔ remote client | Transport and privilege boundaries remain explicit; no parallel privileged path | `src-tauri/src/commands.rs`, `src/modules/terminal/lib/pty-bridge.ts` |
| Composite | Terminal pane trees and canvas dock trees | Leaves and groups use the same tree traversal/update model | `src/modules/terminal/lib/panes.ts`, `src/modules/tabs/lib/tabTypes.ts` |
| Facade | App coordinator, native client, remote facade | Callers use a small workflow surface instead of reimplementing subsystem coordination | `src/app/App.tsx`, `src/modules/ai/lib/native.ts`, `src-tauri/src/modules/remote.rs` |
| Flyweight | xterm renderer pool | Renderer instances are reused and rebound; pane switching does not recreate them | `src/modules/terminal/lib/rendererPool.ts`, `docs/adr/0002-terminal-renderer-pool.md` |
| Proxy | AI HTTP, workspace authorization, secret access | Security and authorization checks cannot be bypassed by calling the underlying resource | `src/modules/ai/lib/proxyFetch.ts`, `src-tauri/src/modules/net.rs`, `workspace.rs` |
| Command | Tauri commands, shortcuts, AI tools, git actions | Action input, approval, execution, and lifecycle semantics remain explicit | `src-tauri/src/commands.rs`, `src/modules/shortcuts/`, `src/modules/ai/tools/` |
| Mediator | App/workspace coordination and event buses | Cross-module coordination goes through a coordinator/event seam, not uncontrolled direct calls | `src/app/App.tsx`, `src/modules/git/events.ts` |
| Memento | Canvas undo/history and workspace layout snapshots | Snapshots contain serializable layout/domain state, never live PTY/process handles | `src/modules/architecture/lib/useCanvasHistory.ts`, `src/modules/tabs/` |
| Observer | PTY channels, Tauri events, DOM events, Zustand subscriptions | Subscribers detach with their owner; events do not become a second source of truth | `src/modules/terminal/lib/pty-bridge.ts`, `src/modules/git/events.ts` |
| Strategy | Agent providers, discovery modes, platform shell behavior | The caller selects behavior through a stable contract; branching stays behind the seam | `src-tauri/src/modules/agent_chat/providers/`, `shell_init.rs` |
| State | Tabs, PTYs, agent runtime, workspace mode | State transitions are explicit and invalid combinations are rejected or represented in the model | `src/modules/tabs/lib/tabTypes.ts`, `src-tauri/src/modules/agent_chat/daemon.rs` |

### Pattern relationships

The most important combinations are:

- **Bridge + Adapter**: `pty-bridge.ts` and agent adapters translate between
  different runtimes without leaking native details into React.
- **Facade + Mediator**: `App.tsx` coordinates features while exposing the
  rest of the app a narrower workflow surface.
- **Composite + State**: pane trees and tagged tabs make recursive structure
  and active behavior explicit together.
- **Flyweight + Singleton**: the renderer pool is shared, bounded, and reused;
  it is not a license for arbitrary global mutable state.
- **Command + Observer**: commands cause actions, events report results;
  neither should silently replace the other as the source of truth.
- **Memento + State**: persisted and undoable state is metadata; live native
  resources remain outside snapshots.

---

## 5. Conditional and deferred patterns

These patterns may be used only when the concrete problem exists and the seam
is documented.

### Conditional

- **Prototype** — workspace/canvas duplication may clone a complete serializable
  snapshot and regenerate identity fields. Never clone a live PTY or process.
- **Factory Method** — use only when independent implementations own their
  creation decision behind a shared lifecycle. A group of `create*` functions
  is Simple Factory, not Factory Method.
- **Chain of Responsibility** — use for an ordered handler pipeline where each
  handler can process or pass a request. Test ordering and stop behavior.
- **Template Method** — use only when an algorithm is stable and replaceable
  steps are real. Prefer Strategy and composition for provider behavior.

### Not currently required

- **Abstract Factory** — no current family-of-compatible-products seam.
- **Builder** — use typed factories or existing library builders; do not wrap
  a short configuration object in a new builder without demonstrated depth.
- **Decorator** — wrapper/middleware layers must have an explicit ordering and
  contract; provider nesting alone is not enough.
- **Iterator** — ordinary array or tree traversal is not an Iterator pattern.
- **Visitor** — do not add double dispatch for canvas/tab nodes without many
  operations over stable node types.

If a feature needs a conditional or deferred pattern, record the problem,
alternatives, interface, lifecycle, and tests in the change. Add an ADR when
the choice becomes durable architecture.

---

## 6. Non-negotiable invariants

These invariants are stronger than any pattern name:

- **Two-process model:** all filesystem, process, shell, network-sensitive, and
  secret operations cross the Rust/Tauri interface.
- **Single source of truth:** `App.tsx` owns workspace/tab/pane coordination;
  feature modules do not create competing copies of that state.
- **Terminal ownership:** standard terminals use the shared renderer pool and
  terminal session path; canvas terminals own private xterm + PTY instances.
- **Camera isolation:** canvas camera transforms do not trigger PTY fit/resize
  on every camera tick.
- **Serializable snapshots:** workspace/canvas persistence and undo history
  store layout/domain metadata only.
- **Security proxy:** AI path guards, workspace authorization, SSRF defenses,
  and keychain boundaries apply at the native seam and cannot be bypassed by a
  second caller path.
- **Lifecycle symmetry:** every open/spawn/subscribe operation has a matching
  close/dispose/detach path.
- **Canonical paths:** frontend paths use forward slashes; conversion happens
  at the native/platform boundary.
- **Agent residency:** durable `chatId` maps to at most one provider runtime;
  detach does not mean explicit close. See the active agent daemon plan.

---

## 7. How to add a feature

1. Read [`CMDSPACE.md`](../../CMDSPACE.md), this file, and the owning module's
   existing tests.
2. Name the module, external interface, seam, and applicable pattern before
   editing.
3. Reuse an existing seam and source of truth. Do not add a parallel IPC,
   terminal, persistence, or event path.
4. Keep the module deep: expose a small interface and hide lifecycle,
   platform, persistence, and error-handling complexity inside it.
5. If adding a native capability, update the Rust command, command registry,
   capability allowlist, and frontend client together.
6. If changing a pattern invariant, stop and document the alternative and
   recovery path before implementation.
7. Add focused regression tests at the changed seam.
8. Run the verification required by the affected layer.

Completion means the pattern impact is named, the invariant is preserved or
formally changed, the seam is tested, and no second source of truth exists.

---

## 8. How to refactor a pattern seam

Use this sequence for cleanup or decomposition:

1. **Map:** find callers, state owners, side effects, and existing tests.
2. **Lock behavior:** add regression coverage if the seam is not already
   protected.
3. **Choose depth:** move complexity behind a smaller interface; do not split
   a file merely to reduce line count.
4. **Move one concern:** keep ownership and lifecycle in the current owner
   until the replacement seam is verified.
5. **Verify transitions:** test success, failure, detach/close, cleanup, and
   cross-platform branches as applicable.
6. **Record the decision:** update this map and an ADR when the architecture or
   invariant changed.

The deletion test applies: if deleting the proposed module makes complexity
reappear across many callers, the seam is earning its keep. If it only wraps
one call without hiding behavior, it is probably a shallow abstraction.

---

## 9. How to debug

- **IPC mismatch:** compare frontend invocation, `commands.rs` registration,
  Rust command signature, and capabilities in that order.
- **Duplicate terminal:** inspect renderer pool binding and session ownership;
  do not solve it by creating another pool.
- **Canvas terminal bug:** inspect the private node PTY lifecycle separately
  from the standard `TerminalStack` lifecycle.
- **Agent duplication:** trace durable `chatId` → daemon index → runtime ID →
  provider process. A remount must attach, not spawn another provider.
- **Stale event:** inspect Observer subscription cleanup and event sequence;
  confirm that persisted state was not accidentally used as a live event bus.
- **Security bypass:** trace the caller through the Proxy seam and verify the
  same path guard/authorization check applies to read and write operations.
- **Undo/persistence corruption:** inspect Memento payloads for live handles,
  ephemeral IDs, or platform-specific paths.
- **IME/input issue:** read [`terminal-input-pipeline.md`](terminal-input-pipeline.md)
  and log bytes at the PTY boundary; visual spaces can be C1/NBSP corruption.

---

## 10. Verification

### Frontend-only pattern changes

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

### Rust/Tauri pattern changes

```bash
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
```

### Pattern-specific proof

- Bridge: command contract and capability tests.
- Adapter/Strategy: every provider/platform branch has focused parsing or
  selection tests.
- Composite: leaf/group traversal and tree mutation tests.
- Flyweight/Singleton: reuse, bounded capacity, and cleanup tests.
- Proxy: denied path/host and allowed path/host tests.
- Command/Observer: action dispatch, subscription cleanup, and event ordering.
- Memento/State: snapshot restoration and valid transition tests.
- Agent runtime: idempotent start, attach replay, detach-without-kill,
  explicit close, and idle reaper tests.

Do not claim a pattern-preserving change is complete until the relevant proof
has passed or the missing proof is explicitly reported.

---

## 11. Known gotchas

- React 19 Strict Mode can double-mount terminal effects in development; this
  is expected and must not lead to a second permanent ownership path.
- The renderer pool is a performance boundary, not a general-purpose cache;
  respect its capacity and eviction rules.
- Canvas terminals must never be routed through `TerminalPane` or the shared
  renderer pool.
- `App.tsx` is a coordinator. Extract pure transitions and deep modules before
  moving ownership of workspace/tab/pane state.
- `Builder`, `Iterator`, and `Decorator` names in a diff do not prove those
  patterns are appropriate. Verify the seam and the invariant.
- Pattern names are not a substitute for tests, an interface, or a product
  decision.
