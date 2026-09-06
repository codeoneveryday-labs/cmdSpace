# Canvas Orchestration MVP Contract

Orchestration is a Canvas-only capability. `standard` workspaces remain direct
terminal/pane workspaces and `agent` workspaces remain single-agent chats. A
Canvas is either an `architecture` diagram or an `orchestration` graph; legacy
diagrams without `canvasPurpose` hydrate as `architecture`.

The Canvas stores layout and stable semantic bindings only. Runtime state,
provider sessions, worktrees, execution attempts, and event history belong to
the native orchestration runtime and SQLite. The semantic graph has separate
`orchestrator`, `agent`, and `task` nodes. MVP edges are `assignment` and
`dependency`.

The Orchestrator proposes an untrusted tagged JSON manifest. Native validation
checks version, providers, unique IDs, assignments, dependency existence,
cycles, and non-empty validation commands. Every draft edit increments a
revision; approval must name the current revision. No worker or worktree is
created before valid approval.

Rust owns scheduling and transitions; provider adapters remain behind the
existing Agent Chat runtime. The scheduler admits at most three tasks at once
and at most one task per agent. Writable tasks run in dedicated worktrees and
are committed and merged sequentially into `cmdspace/orch-<run-id>`. The user
working branch is never changed, and generated branches/worktrees are not
cleaned automatically.

Canvas attachment is a UI concern. Detaching or unmounting the Canvas must not
stop the scheduler or provider session. Events use a monotonic per-run
sequence and bounded replay. On restart, persisted running/validating work is
marked `interrupted`; resuming is always explicit.

Validation and provider failures do not retry automatically. Dependency
failures block downstream tasks. Integration conflicts block the affected task
and its downstream tasks and leave the run for user recovery. A successful run
ends at `review_required` on the internal integration branch; MVP does not
merge or cherry-pick into the user branch.

The Munder Difflin reference informed the boundary: orchestration intelligence
belongs to the Orchestrator, while Rust is the deterministic mechanism; the
structured orchestration event plane stays separate from raw terminal output.
Peer worker mailboxes, autonomous approval, remote/voice orchestration, and
automatic cleanup are outside this MVP.
