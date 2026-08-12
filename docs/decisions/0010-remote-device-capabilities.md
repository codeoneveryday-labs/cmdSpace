# 0010 Scope Native Remote Access to a Device Capability

Date: 2026-08-12

## Status

Accepted

## Context

The browser Remote Access client uses a password bootstrap and bearer token.
That is compatible with a browser but cannot identify, revoke, or constrain one
native iPhone/iPad independently from another client. Native mobile also needs
to survive reconnects without retaining a shared password.

Zedra's pairing model demonstrates the useful boundary: device identity is
separate from transport, pairing is short-lived, and authorization is scoped
to a host session rather than granted implicitly to every remote operation.

## Decision

Native-device pairing uses a random, one-time, expiring QR grant. The QR has a
host fingerprint, grant identifier, expiration, requested device display name,
and a `DeviceCapability`; it never contains a durable session token or device
private key. The mobile client creates its own signing key and stores its
private half in platform secure storage. The desktop stores only the device
public identity and the capability record.

`DeviceCapability` has these fields:

```text
workspace_id: String
terminal_policy: AnyOwnedSession | ExplicitSessionIds(Vec<u64>)
can_view: bool
can_input: bool
can_create_terminal: bool
can_close_terminal: bool
```

Every native-device remote operation is authorized at the desktop host. UI
filtering is not authorization. Listing sessions and receiving terminal output
need `can_view`; attach, input, and resize need `can_input`; creation and close
need their corresponding fields. The requested workspace must match
`workspace_id` before any terminal operation is accepted.

P0 has one active native device controller per terminal. A second device that
tries to attach receives `session_occupied`. An explicit user-approved takeover
operation can be added later; concurrent input is not an allowed fallback.

The host lists paired devices with display name and revocation state. Revoking
a device invalidates its future signed reconnects without affecting unrelated
native devices or existing browser/password sessions. Active-session eviction
and last-seen metadata are a follow-up once the iOS client exists.

Existing website Remote Access remains on protocol v2 and its password/token
flow. Native device pairing is protocol v3. Both use the same desktop Remote
Access server, public tunnel/LAN listener, terminal runtime, and PTY authority.

## Alternatives Considered

1. Continue using one shared remote password for native devices. Rejected:
   cannot revoke or audit one lost device and grants every device the same
   authority.
2. Grant all desktop workspaces to a paired device. Rejected: remote scope must
   be explicit before future file, git, agent, or terminal actions are added.
3. Permit simultaneous terminal control. Rejected: interleaved input cannot be
   reconstructed safely or explained to a user.
4. Replace the existing tunnel with Iroh/QUIC before native pairing. Rejected:
   transport migration is not necessary to establish device authorization and
   would delay browser-compatible mobile access.

## Consequences

Positive:

- A lost phone can be revoked without logging out every client.
- The desktop remains the only policy enforcement point.
- Future clients can use the same identity/capability model over a different
  transport without changing terminal authority.
- Browser compatibility remains intact during migration.

Tradeoffs:

- Host state gains a durable device registry.
- Pairing protocol and mobile secure-key storage add implementation work.
- Native clients must explain denied/occupied states rather than retry them.

## Follow-Up

- Add an iOS protocol v3 client before persisting native credentials in
  Keychain.
- Add active-session eviction, last-seen metadata, and user-approved takeover
  after the iOS client exists.
- Define an explicit takeover UX only after P0 exclusive ownership is validated.
