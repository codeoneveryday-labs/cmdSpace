# 0008 Keep Remote Workspace Selection Behind Pairing

Date: 2026-07-22

## Status

Accepted

## Context

The mobile Remote UI needs a convenient QR entry point and a file/folder
picker before starting a terminal. Both features expose host information if
they are placed on the wrong side of the authentication boundary. Provider
output can also contain documentation links that resemble public tunnel URLs.

## Decision

Encode only the ready public tunnel URL in the Settings QR code. Keep the
one-time pairing code separate and require a valid bearer token before serving
directory metadata. After every new pairing, clear any remembered workspace
selection and require the user to choose a file or folder again. A folder
becomes the terminal working directory; selecting a file uses its containing
folder. Directory responses contain names and canonical paths only, never file
contents, and remain constrained by the existing authorized cwd boundary.

Only provider subdomains are accepted as public tunnel URLs. Bare provider
domains and documentation links are rejected.

Keep an unused, unexpired pairing code visible to the local Settings window
even when Remote Access was auto-started. Once consumed it is hidden, and the
user can explicitly rotate it to pair another device without restarting the
remote server.

## Alternatives Considered

1. Embed the pairing code in the QR. Rejected because screenshots and camera
   history would then contain an authentication secret.
2. Show the picker before pairing. Rejected because it would expose host
   filesystem metadata to unauthenticated clients.
3. Open a selected file remotely. Rejected because the requested flow only
   needs a terminal cwd and reading contents would broaden the data boundary.

## Consequences

Positive:

- Scanning the QR is convenient without weakening pairing.
- Every newly paired browser makes an explicit cwd choice.
- Auto-start and subsequent devices retain a usable pairing path.
- The picker cannot read or return file contents.
- Documentation URLs cannot be advertised as live tunnels.

Tradeoffs:

- Re-pairing intentionally discards the browser's remembered cwd.
- Rotating a pairing code immediately invalidates the previous code.
- Selecting a file opens its parent directory rather than the file itself.

## Follow-Up

- Add a user-controlled recent-folder list only if the explicit picker becomes
  too repetitive; it must remain behind bearer authentication.
- Persist this decision through Harness when the documented CLI binary is
  restored.
