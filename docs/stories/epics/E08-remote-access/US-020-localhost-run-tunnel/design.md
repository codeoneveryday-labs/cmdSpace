# Design

## Domain Model

`RemoteServer` owns both the local listener and an optional supervised tunnel.
The tunnel snapshot contains a state (`starting`, `ready`, `degraded`, `error`,
or `stopped`), an optional public URL, and an optional diagnostic message.

## Application Flow

1. Bind and start the local authenticated server.
2. Start a supervisor that owns the SSH child process.
3. Read both SSH output streams and accept only trusted HTTPS provider URLs.
4. Promote the public URL when announced; otherwise retain the LAN URL.
5. Retry unexpected exits with bounded backoff while enabled.
6. On stop, signal and join the tunnel supervisor before stopping the server.

## Interface Contract

The existing Tauri commands remain stable. `RemoteAccessStatus` adds
`lanUrl`, `publicUrl`, `tunnelState`, and `tunnelError`; `url` remains the
preferred URL and therefore stays backward compatible.

## Data Model

No persistent data is added. Tunnel URLs and diagnostics are process-local and
ephemeral.

## UI / Platform Impact

Settings shows whether the tunnel is connecting, public, degraded, or errored.
The implementation uses the platform `ssh` executable and hides its console on
Windows.

## Observability

Lifecycle transitions and provider failures are available through status and
logged without pairing secrets or terminal data.

## Alternatives Considered

1. Make tunnel startup synchronous. Rejected because network startup must not
   block the Tauri command or disable LAN fallback.
2. Share `Child` behind a mutex. Rejected because a blocking wait can prevent
   prompt shutdown; the supervisor exclusively owns and polls the child.
