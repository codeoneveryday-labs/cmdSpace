# Exec Plan

## Goal

Add ZenMux as a selectable Anthropic-compatible AI provider with `z-ai/glm-5.2`.

## Scope

In scope:

- Provider catalog entry.
- Initial model catalog entry.
- Keyring default key map.
- AI SDK model builder branch.
- Provider icons in Settings and status bar picker.
- Product/story docs and source-level regression test.

Out of scope:

- Live API smoke test without a user-provided key.
- Model discovery or pricing sync.
- New backend/Tauri commands.

## Risk Classification

Risk flags:

- External systems.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- External provider behavior.

## Work Phases

1. Discovery of current provider wiring and AI SDK Anthropic base URL support.
2. Write failing source regression test.
3. Implement provider/model/keyring/icon/builder wiring.
4. Verify targeted test, typecheck, and full test suite.
5. Update Harness story evidence and durable proof.

## Stop Conditions

Pause for human confirmation if:

- ZenMux requires non-Anthropic request semantics.
- Adding the provider requires storing credentials outside the keychain.
- Validation requires a live key and the user has not provided one.
