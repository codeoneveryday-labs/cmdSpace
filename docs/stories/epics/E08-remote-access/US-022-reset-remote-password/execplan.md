# Exec Plan

## Goal

Recover a forgotten remote password from the trusted Mac UI.

## Scope

In scope: local reset command, credential rotation, live-session revocation,
fresh setup QR, confirmation UI, and regression tests.

Out of scope: account recovery services and manual QA.

## Risk Classification

Risk flags: Auth, audit/security, public behavior, cross-platform remote client.
Hard gate: Auth.

## Work Phases

1. Lock reset semantics with failing tests.
2. Implement auth rotation and local IPC.
3. Add the confirmed Settings action.
4. Run automated Rust and TypeScript verification.

## Stop Conditions

Stop if reset would expose a recovery secret remotely or preserve old sessions.
