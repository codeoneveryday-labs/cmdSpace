# Mobile workspace ownership

## Outcome

Make a paired iOS device own an independent set of mobile workspaces. A mobile
workspace may point at a permitted desktop directory, but it must never be
created from, hydrate, or replay a desktop workspace pane.

## Decisions

- A **Desktop Workspace** remains the desktop-only workspace/pane aggregate.
- A **Mobile Workspace** is persisted by the desktop host and scoped to one
  paired device. It stores only user-facing metadata and an authorized working
  directory.
- A **Mobile Terminal** is a child runtime of a Mobile Workspace. Its PTY is
  intentionally ephemeral; a host restart stops it rather than attempting to
  replay desktop commands.
- Agent import creates a new Mobile Terminal and resumes a saved agent session;
  it never attaches to an existing desktop agent process.

## Implementation sequence

1. Add a separate SQLite projection for Mobile Workspaces, including owner
   device identity and directory metadata.
2. Change native-device workspace, files, import and terminal commands to
   resolve only Mobile Workspaces owned by that device.
3. Remove desktop workspace-pane hydration and last-command replay from the
   native-device session list. Filter remote runtime sessions by owner device.
4. Retain existing raw-output transport temporarily; a subsequent renderer
   slice will replace it with host-authoritative screen snapshots.

## Recovery

The migration only adds tables. Desktop workspace and pane rows are neither
read nor modified by the mobile protocol. Existing iOS cached entries will be
replaced on the next authenticated workspace refresh.

## Validation

- Rust database tests prove the two workspace namespaces stay separate.
- Remote tests prove the device session list does not hydrate desktop panes.
- Protocol/core/iOS source checks and simulator build remain green.

## Progress

- Completed: added device-scoped `mobile_workspaces` persistence; native
  workspace, files and session creation now resolve only that namespace.
- Completed: removed native desktop pane hydration and `last_command` replay;
  native session projections are filtered by the paired-device owner.
- Completed: iOS cache keys are scoped to the paired device and the UI names
  these entries Mobile Workspaces.
- Remaining: replace raw ANSI output replay with an authoritative host screen
  snapshot/delta protocol. This is intentionally a separate rendering slice.
- Completed: reused the desktop's authorized folder browser in the iOS mobile
  workspace creation sheet; users select a folder and its name pre-fills the
  workspace name rather than typing a desktop path.
