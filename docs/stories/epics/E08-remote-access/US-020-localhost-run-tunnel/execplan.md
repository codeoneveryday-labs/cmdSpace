# Exec Plan

## Goal

Provide a supervised public HTTPS route for Remote Access without weakening its
authentication or LAN behavior.

## Scope

In scope:

- SSH provider process, output parsing, retry, shutdown, status, and Settings UI.

Out of scope:

- Provider accounts, custom domains, persistence, and additional providers.

## Risk Classification

Risk flags:

- External system, public endpoint, background process, cross-platform shell.

Hard gates:

- Existing authentication remains mandatory through the tunnel.
- LAN access survives provider failure.
- Shutdown leaves no child process behind.

## Work Phases

1. Capture the product and security boundary.
2. Add failing parser and lifecycle tests.
3. Implement the tunnel supervisor.
4. Integrate server status and Settings polling.
5. Run Rust and frontend verification.
6. Record Harness CLI availability as a tooling gap.

## Stop Conditions

Pause only if implementation requires weakening authentication, adding a new
dependency, or changing the approved provider architecture.
