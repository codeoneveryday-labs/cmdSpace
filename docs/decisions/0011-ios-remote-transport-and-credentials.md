# 0011 Keep iOS Remote Credentials Device-Bound and Transport-Safe

Date: 2026-08-12

## Status

Accepted

## Context

The iOS client will connect to the existing desktop Remote Access service that
also serves the browser remote UI. It must persist enough material to reconnect
without persisting the browser's shared password, and it must not expose
pairing secrets through logs, crash reports, or QR URLs after parsing.

## Decision

The iOS adapter owns exactly one `URLSessionWebSocketTask`. It sends and
receives versioned protocol envelopes only after the Rust lifecycle core emits
the appropriate effect. It owns a device private signing key in Keychain using
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

Release builds accept only `wss` for non-loopback Remote Access endpoints.
`ws` is allowed solely for an explicitly marked loopback development test path.
Before device credentials are sent, the iOS adapter verifies the host identity
against the fingerprint included in the pairing QR. The desktop Settings QR is
the source of both the host endpoint and host identity for native pairing.

The iOS adapter clears Keychain entries when the user chooses Forget desktop or
the host reports that the device is revoked/unauthorized. It never logs device
keys, pairing grants, session credentials, WebSocket authorization values, or
terminal output.

When iOS enters background it cancels the WebSocket and preserves only its
Keychain identity. When it returns foreground it asks the Rust lifecycle core
to reconnect with a fresh signed challenge; it does not assume a suspended
socket remains valid.

## Alternatives Considered

1. Persist the existing browser password. Rejected: it is shared credential
   material and cannot identify an individual native device.
2. Permit cleartext LAN WebSocket in release builds. Rejected: a device client
   must not send long-lived identity material across an unprotected network.
3. Keep WebSocket alive while backgrounded. Rejected: iOS scheduling does not
   provide reliable lifecycle guarantees and reconnect is clearer/safer.

## Consequences

- iOS can reconnect after a relaunch without requesting a shared password.
- Desktop public-tunnel behavior remains compatible with browser remote access.
- LAN support for release requires a TLS-capable host endpoint or a later
  approved transport decision.
- Simulator/development testing may use a clearly isolated loopback path.

## Follow-Up

- Implement protocol v3 device pairing and host fingerprint validation.
- Add a Keychain adapter only after the Rust lifecycle core and C ABI are
  available.
- Test background/foreground, revocation, and host restart before TestFlight.
