# 0007 Keep localhost.run Outside the Remote Authentication Boundary

Date: 2026-07-21

## Status

Accepted

## Context

Remote Access needs an HTTPS URL that a phone can reach without requiring the
user to configure a router. The selected provider creates that route with an
SSH reverse tunnel, but it must not become the authority for terminal access or
make LAN access dependent on an external service.

## Decision

Start the authenticated cmdSpace remote server first, then run
`ssh -R 80:127.0.0.1:<port> nokey@localhost.run` as a supervised child process.
Treat the provider strictly as transport: all pairing and session authorization
remain in cmdSpace. Keep the LAN URL as a fallback, expose the public URL only
after parsing a trusted HTTPS provider hostname, retry unexpected exits with
bounded backoff, and stop the child before shutting down the local server.

## Alternatives Considered

1. Embed provider-specific authentication. Rejected because it would split the
   security model and couple terminal access to a third party.
2. Replace LAN access with the public tunnel. Rejected because external outages
   would make a local feature unavailable.
3. Add a tunnel SDK or HTTP relay dependency. Rejected because OpenSSH already
   provides the required transport and keeps the implementation auditable.

## Consequences

Positive:

- Public access reuses the existing secure protocol.
- Provider failures degrade to LAN instead of stopping Remote Access.
- The child process has one explicit lifecycle owner.

Tradeoffs:

- The host needs OpenSSH and internet access.
- Free public hostnames may change after reconnects.
- The UI must represent local server state and tunnel state separately.

## Follow-Up

- Add provider-independent configuration only if a second tunnel provider is
  actually required.
- Persist Harness decision records when the repository's documented CLI binary
  is restored.
