# Execution Plan: Agent Chat Provider Modules

Date: 2026-08-27

## Status

Completed

## Outcome

Each CLI provider has a dedicated module that owns its launch profile and
control/default mapping, so provider changes do not require editing a shared
provider switch in multiple places.

## Scope

In scope:

- Dedicated provider files for Codex, Claude, OMP, Gemini, OpenCode, and Cmd.
- One shared provider interface consumed by launch and control discovery.
- Preserve existing runtime behavior and tests.

Out of scope:

- Adding new CLI providers.
- Rewriting persistent session transports.

## Progress

- [x] Create the provider interface and provider modules.
- [x] Route launch/control metadata through the interface.
- [x] Add focused provider-profile tests and run validation.

## Result

Launch profile and model/control discovery metadata now live in one module per
provider under src-tauri/src/modules/agent_chat/providers. Shared runtime and
parser code continue to own transport mechanics and common JSON parsing.

## Validation

- Focused Rust agent-chat tests.
- TypeScript check and frontend focused tests.
- `cargo check --all-targets --locked`.
