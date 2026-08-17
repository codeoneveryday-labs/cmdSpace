# Terminal Collaboration Capabilities Design

## Goal

Let users coordinate several existing cmdSpace terminal panes safely: a typed
frontend-to-native boundary, opt-in keyboard broadcast, visible output activity,
and opt-in agent worktree isolation. The features apply to current terminal
tabs and workspaces; no parallel workspace type is introduced.

## Scope and non-goals

The work covers standard terminal panes only. Canvas terminals retain their
private PTY lifecycle and are not broadcast targets or worktree-managed by this
feature. Existing tabs, persisted workspace layouts, terminal cwd behavior, and
plain terminals continue to work unchanged when collaboration features are not
enabled.

This does not add agent-to-agent messaging, an MCP server, AI-CLI semantic
state inference, automatic worktree cleanup, or a new workspace model. Those
are separate product decisions.

## Architecture

### Typed native bridges

Frontend components use module-local typed bridge functions rather than calling
`invoke()` themselves. The terminal bridge stays the authority for PTY open,
write, resize, metadata, and close. Collaboration-specific operations use a
small companion bridge only when a native operation is necessary. Types mirror
the registered Rust command contract, including nullability and event payloads.

The bridge is a boundary, not a second state store. `App.tsx` remains the
coordinator for tab and workspace state; terminal modules retain ownership of
live sessions and input handling.

### Broadcast input

Broadcast state belongs to an existing standard terminal tab:

- `enabled` arms or disarms fan-out.
- `targetLeafIds` contains explicitly selected pane leaves.
- the active source pane may be a target, but a target is valid only while its
  terminal session is live.

The standard terminal input path resolves the selected leaf ids to live PTY
sessions immediately before writing. It writes each user-originated input chunk
once to each eligible target. PTY output, terminal resize, initial commands,
programmatic writes, and AI tool calls are never broadcast. Closing a pane
removes it from the target set.

### Output activity

Activity is derived from raw PTY output at the standard terminal session
boundary. A pane becomes active when it receives output and returns idle after
a fixed, documented quiet window. It is an operational indicator, not a claim
that an AI is thinking, waiting for permission, or complete. The timer is
cleared when a session exits or is disposed, avoiding stale active indicators.

Activity is ephemeral and is not persisted with a workspace layout.

### Agent worktree isolation

Worktree isolation is opt-in when launching or switching an agent terminal;
plain terminal creation retains its selected cwd. The native layer validates
the selected repository and creates a dedicated worktree/branch before the PTY
launches. The resulting worktree path is the terminal cwd and its branch/path
metadata remains associated with that agent pane for UI display and deliberate
cleanup.

Creation failure leaves the terminal unlaunched with an actionable error; it
does not silently run the requested agent in the original repository. Closing a
pane only ends its PTY. Cleanup is an explicit user action, refuses dirty or
unmerged worktrees, and rejects paths outside the managed worktree location.

## Data flow

```text
terminal-pane UI
  -> terminal/tab state in App.tsx and useTabs
  -> typed terminal collaboration bridge
  -> Rust command / PtyState
  -> Channel<ArrayBuffer> PTY output
  -> standard terminal session
  -> activity state and terminal UI

user terminal input
  -> terminal session resolves broadcast targets
  -> one pty_write per live selected target
```

## Error handling

- A stale broadcast target is skipped and removed from tab state; it cannot
  cause the source write to fail.
- A PTY write error is reported for the affected terminal and does not retry
  into another pane.
- Worktree validation and creation failures return explicit native errors that
  the launch UI displays. No fallback to the repository root occurs.
- Closing, session exit, and tab disposal clear activity timers and broadcast
  membership idempotently.

## Testing and validation

Each behavior begins with focused Vitest coverage:

- typed bridge serialization and error propagation;
- target selection, duplicate prevention, stale target pruning, and the rule
  that programmatic writes never broadcast;
- activity activation, idle expiry, and session-disposal cleanup using fake
  timers;
- worktree path/branch derivation and destructive-safety guards.

Rust worktree commands receive unit coverage for validation and refusal paths.
The complete feature requires focused Vitest suites, `pnpm exec tsc --noEmit`,
`pnpm build`, and `cd src-tauri && cargo check --all-targets --locked`.

## Delivery order

1. Establish typed bridge boundaries with no behavior change.
2. Add output activity state and pane presentation.
3. Add opt-in broadcast input for standard terminal panes.
4. Add agent-launch worktree isolation and explicit safe cleanup.

Each increment stays independently usable and avoids touching canvas-terminal
ownership.

## Decisions

- Apply collaboration capabilities directly to existing terminal tabs and
  workspaces.
- Default worktree isolation to disabled and select it per agent launch.
- Treat terminal activity as output-driven only.
- Preserve worktrees when panes close; never auto-delete them.
