# Design

## Domain Model

`RemoteAuth` owns the password verifier, signing key, setup secret, and live
session generation. Reset rotates all authentication material atomically in
memory after the persisted verifier is removed.

## Application Flow

The local Tauri command validates that Remote Access is running, removes the
verifier, resets authentication, and returns status containing the fresh setup
secret. Settings rebuilds the QR from that status.

## Interface Contract

`remote_access_reset_password` is local IPC only and returns
`RemoteAccessStatus`. It is registered alongside the existing remote commands.

## Data Model

No schema change. The existing verifier file is deleted.

## UI / Platform Impact

Mac Settings shows a destructive reset button with native confirmation.

## Observability

Log reset completion without passwords, tokens, or setup secrets.

## Alternatives Considered

1. Keep active WebSockets until reconnect. Rejected because reset must sign out
   every connected device.
