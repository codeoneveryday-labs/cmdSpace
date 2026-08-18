# iOS ↔ Desktop Remote Integration Contract

**Purpose:** Preserve the working iOS remote-terminal behavior while the SwiftUI presentation is replaced from the Pencil design. This document records the interface that UI code must consume rather than recreate.

## Authority and ownership

| Concern | Authoritative owner | iOS role |
|---|---|---|
| Pairing grants, expiry, and revocation | Desktop `src-tauri/src/modules/remote.rs` and `remote_devices.rs` | Submit pairing payload and retain only the device identity/key material in Keychain. |
| Device authentication | Desktop device WebSocket endpoint | Sign the server challenge, then wait for `authenticated`. |
| Mobile workspaces | Desktop-hosted `mobile_workspaces`, scoped to the paired device | Render only the received device-owned list; do not open desktop SQLite directly or project desktop panes. |
| Terminal processes, output buffer, resize and close | Desktop remote runtime backed by mobile-owned PTYs | Select/attach a session and issue protocol commands only after attachment acknowledgement. |
| Mobile navigation, UI state, appearance preference | iOS app | Translate user intent into `RemoteStore` actions. It must not duplicate desktop process state. |

## The one UI seam: `RemoteStore`

`mobile/ios/CmdSpaceMobileApp/RemoteStore.swift` is the integration module. New SwiftUI screens must use its published state and public actions; they must not create another WebSocket, compose protocol envelopes, or retain a second selected-session state.

### Published state that screens may read

| State | Meaning | Intended UI use |
|---|---|---|
| `state` | `.unpaired`, `.connecting`, `.connected`, `.failed(message)` | Root navigation and neutral/recoverable connection feedback. |
| `recentWorkspaces` | Desktop-provided Mobile Workspaces for this paired device | Pencil Home/Workspace list. Show at most the product-chosen number; never fabricate paths. |
| `selectedWorkspace` | Current local workspace selection | Workspace title and filtered terminal list. |
| `sessions`, `activeSessionId` | Server-provided remote runtime sessions and current target | Workspace and terminal navigation. |
| `activeTerminalReady` | Desktop has completed `Attach` | Gate all input, key controls and resize UI. |
| `terminalText` | Latest raw terminal output/snapshot | Terminal renderer only. |
| `pairingSheetOpen` | Current connection presentation intent | Quick Connect sheet. |

### Actions that screens may call

| User intent | `RemoteStore` action | Protocol result |
|---|---|---|
| Connect a new desktop | `pair(from:)` | Device pairing challenge, then saved device identity. |
| Re-open saved desktop | `reconnectSavedDesktop()` | Authenticated device session. |
| Open workspace | `openWorkspace(_)` | Local selection followed by session refresh/attach flow. |
| Refresh remote data | `refreshWorkspaces()`, `refreshSessions()` | `ListWorkspaces` / `ListSessions`. |
| Pick terminal | `attach(_)` | `Attach`, then `Attached { session_id }`, snapshot/output. |
| Create standard terminal | `createTerminal()` | `CreateTerminal`; desktop owns spawned PTY. |
| Type/send modifier key | `sendInput(_)`, `sendKey(_)` | `Input`; valid only after `activeTerminalReady`. |
| Resize terminal canvas | `resizeActiveTerminal(cols:rows:)` | `Resize`; valid only after `activeTerminalReady`. |
| Leave workspace/device | `closeWorkspace()`, `disconnect()` | Clears iOS selection / closes socket; does not delete desktop data. |

## Transport lifecycle

Native iOS pairing can use the stable Cloudflare relay instead of the direct
desktop address. The relay is a transparent transport multiplexer: both the
desktop and iPhone initiate outbound WSS connections, then the desktop bridges
each mobile socket into its existing local v3 handler. This lets a Mac at home
remain reachable across changing networks without opening a router port or
sharing a terminal session with the desktop UI.

The Worker URL is public, but the desktop role requires a locally persisted
high-entropy credential; the QR contains only the random relay ID and a
one-time device pairing grant. The relay retains connection tags and a hash of
the desktop credential, never workspace contents, terminal output, or grants.

### Shared stable relay, separate remote protocols

The browser remote should adopt this same **outbound relay transport**. It
must not adopt the iOS/native-device authorization protocol. Both clients gain
a stable, cross-network route to the desktop, while their protocol and trust
boundaries stay distinct:

```text
Browser remote ─ WSS ─┐
                      ├─ Cloudflare Durable Object relay ─ WSS ─ Desktop cmdSpace
iOS native app ─ WSS ─┘                                    ├─ browser v2 handler
                                                            └─ native device v3 handler
```

| Peer | Relay role/namespace | Desktop endpoint after bridge | Authentication authority | Session ownership |
|---|---|---|---|---|
| Browser remote | `browser` | Existing browser v2 WebSocket handler | Existing password/token flow on desktop | Browser remote runtime rules; no device capabilities. |
| iOS native app | `device` | Existing native v3 WebSocket handler | Desktop pairing grant, device key, challenge, and capability registry | Mobile workspace and terminal rules scoped to that paired device. |
| Desktop | `desktop` | Local bridge owner | Persistent relay credential plus each protocol's existing authentication | Sole authority for PTYs, workspace data, grants, and revocation. |

Implementation rules for browser relay support:

1. Allocate a distinct relay role or route namespace such as
   `/relay/<relay-id>/browser`; never route browser frames to
   `/api/remote/device/ws`.
2. Preserve the browser v2 envelope and desktop password/token validation
   byte-for-byte. The relay must not mint browser tokens or accept a browser
   password.
3. Keep the native v3 pairing challenge, Keychain identity, and device
   capability checks unavailable to browser sockets.
4. A relay outage is a recoverable transport state. It must not be represented
   as an authentication failure, revoke a device, or reset browser credentials.
5. Keep LAN/direct browser access as an explicit fallback until browser relay
   coverage proves equivalent behavior.

This is deliberately closer to a reverse WebSocket tunnel than a Remote MCP
Connector: Cloudflare carries frames, while cmdSpace on the desktop remains
the only application server and security authority.

```text
iOS PairingLinkView
  → RemoteStore.pair(from:)
  → device WebSocket /api/remote/device/ws
  → PairDevice (first pairing) or AuthenticateDevice (saved identity)
  ← authenticated
  → ListWorkspaces + ListSessions
  ← Workspaces + Sessions

iOS Workspace / Terminal screen
  → RemoteStore.attach(session)
  → Attach { sessionId, after }
  ← Attached { sessionId }
  ← Snapshot / Output events
  → Resize, Input, Close only after Attached
```

The explicit `Attached` acknowledgement is a required ordering constraint. It was added because input or resize immediately after app/desktop restart could reach the desktop before its attachment controller existed. The desktop rejects those requests; treating that condition as a general connection failure would incorrectly return the user to Home.

## Desktop implementation evidence

- `crates/cmdspace-remote-protocol/src/lib.rs:52` defines iOS-to-desktop messages, including `ListWorkspaces` and `Attach`.
- `crates/cmdspace-remote-protocol/src/lib.rs:90` defines desktop events, including `Workspaces` and `Attached`.
- `src-tauri/src/modules/remote.rs:1290` handles authenticated device commands. At `:1374` it sends `Attached` only after recording the runtime attachment.
- `src-tauri/src/modules/remote.rs:1494` projects desktop SQLite recent workspaces into the remote protocol. This is why direct SQLite sharing with iOS is neither required nor appropriate.
- `src-tauri/src/modules/remote_devices.rs:251` authorizes input/view/create operations per paired device capability.
- `mobile/ios/CmdSpaceMobileApp/RemoteStore.swift:86`–`:135` is the iOS command surface; `:183` authenticates and `:186` moves to `.connected`.

## UI rewrite invariants

1. **Keep `RemoteStore` as the only networking adapter.** Pencil-driven views may be new, but they call the existing actions above.
2. **Do not access desktop SQLite from iOS.** The remote endpoint deliberately projects only Mobile Workspaces for the paired device. A Mobile Workspace references an authorized desktop folder but never mirrors a desktop workspace or pane.
3. **Standard mobile terminal sessions only.** The remote protocol/runtime exposes new PTYs owned by the paired device. Canvas terminals and all desktop panes remain desktop-only and must not be represented as mobile sessions.
4. **Do not show input until attachment is ready.** A preparing state may be visually redesigned, but cannot be removed as a state.
5. **Keep errors local and actionable.** Pairing expiry belongs in Connect; unavailable desktop belongs in a neutral offline state with a Connect action. Do not emit raw red transport errors into Home or terminal content.
6. **Treat output as terminal data, not application UI.** UI screens may frame it, but must not parse agent-specific output to invent app state.
7. **No duplicate persistence.** Device identity stays in Keychain; desktop owns pairing registry and workspace data. Appearance remains iOS-local.

## Known constraints before UI replacement

### Workspace ownership

A Mobile Workspace persists its name and authorized working directory under the
paired device identity. Its child terminal PTYs are ephemeral: after the host
restarts they are stopped, never recreated by replaying desktop pane commands.
Importing an agent session starts a new mobile PTY with a resume command; it
does not attach an already-running desktop agent process.

### Evidence

- The iOS renderer currently uses `TerminalDisplayText.normalize` before displaying `terminalText` (`RootView.swift` terminal canvas). Its tests cover carriage returns, ANSI stripping and shell-integration sequences.
- This is not a full terminal cell-grid renderer. Complex interactive CLIs/TUIs can require cursor addressing, alternate-screen support and color attributes that the current normalizer does not model.

### Inference — high confidence

The Pencil terminal shell can be implemented now without touching the transport contract. Matching a rich agent TUI visually inside the output area will require a separate renderer capability decision; it should not be smuggled into the UI rewrite.

## Verification to retain after each UI slice

1. `swift test --package-path mobile/ios/CmdSpaceMobileCore`
2. Build the app for the target iPhone 16 Pro simulator.
3. Pair a fresh device; open a recent workspace; attach a standard terminal; run `ls`; rotate/reopen; verify the composer stays disabled until `Attached` and remains usable after reconnect.
4. Verify revoke → new QR pairing works without preserving stale iOS selection.
