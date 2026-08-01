# Remote Access

cmdSpace Remote Access exposes the existing authenticated remote terminal UI to
another device. The terminal and shell processes continue to run on the host
computer; the remote device only sends input and renders output.

## Connection modes

- **LAN fallback:** cmdSpace always starts its local HTTP/WebSocket server first
  and exposes a private-network URL.
- **Public tunnel:** cmdSpace then starts an SSH reverse tunnel through
  `localhost.run`. When the provider announces a valid HTTPS URL, that URL
  becomes the primary connection URL.
- A tunnel failure never stops the local server. Settings reports the failure
  and keeps the LAN URL available.

## Security boundary

- The tunnel forwards only to cmdSpace's existing loopback server.
- Password setup, bearer authentication, WebSocket authorization, and session
  tokens are enforced by cmdSpace, not delegated to the tunnel provider.
- Only HTTPS provider URLs from known `localhost.run` domains are accepted.
- The public URL is ephemeral and must not be treated as a secret.

## Lifecycle

The tunnel reports `starting`, `ready`, `degraded`, `error`, or `stopped`.
Unexpected SSH exits are retried with bounded backoff while Remote Access
remains enabled. Turning Remote Access off stops the tunnel before the local
server so no forwarding process is left behind.

## Password and workspace selection

- Settings renders a setup QR for the ready public URL. Its short-lived
  bootstrap secret can only create the first password and cannot be reused.
- Returning browsers authenticate with that password before they can browse
  host files or create a terminal.
- The Mac Settings window can reset a forgotten password. Reset deletes the
  persisted verifier, revokes issued tokens and live WebSockets, and creates a
  fresh setup QR.
- After pairing, the browser asks the user to select either a folder or a file.
  A folder becomes the terminal working directory; selecting a file uses its
  containing folder.
- Remote browsing remains limited to the user home or the host launch
  workspace and never returns file contents.

## Platform requirements

The host must have an `ssh` executable and outbound access to
`localhost.run`. When either requirement is unavailable, LAN access remains
usable and Settings displays the tunnel error.
