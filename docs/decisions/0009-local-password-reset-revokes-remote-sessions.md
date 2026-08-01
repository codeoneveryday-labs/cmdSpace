# 0009 Reset Remote Password Only From the Host

Date: 2026-07-22

## Status

Accepted

## Decision

Expose password reset only in the local Mac Settings UI. After confirmation,
delete the persisted password verifier, rotate the token-signing key, advance
the live-session generation, and issue a short-lived setup secret for a new QR.
Remote clients cannot invoke this operation.

## Consequences

- Forgotten passwords can be recovered without deleting app data.
- Existing bearer tokens and authenticated WebSockets stop working.
- Every device must authenticate again after the owner creates a new password.

## Alternatives Considered

1. Email recovery. Rejected because cmdSpace has no account service.
2. Remote reset. Rejected because it would weaken the host trust boundary.
