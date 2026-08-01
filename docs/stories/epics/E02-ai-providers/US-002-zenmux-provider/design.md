# Design

## Domain Model

ZenMux is a cloud provider that requires an API key and exposes Anthropic
Messages-compatible routes. The first curated model id is `z-ai/glm-5.2`.

## Application Flow

Settings stores the ZenMux API key in the OS keychain. Model pickers include
ZenMux in the provider list and expose `GLM 5.2` as the initial selectable
model. Chat/autocomplete model construction uses the Anthropic AI SDK provider
with a ZenMux base URL.

## Interface Contract

Provider id: `zenmux`.

Keyring account: `zenmux-api-key`.

Base URL: `https://zenmux.ai/api/anthropic/v1`.

The Anthropic AI SDK sends the key in `x-api-key` and includes
`anthropic-version: 2023-06-01`, matching the user-supplied curl contract.

## Data Model

No database changes.

## UI / Platform Impact

Settings and model dropdowns need a ZenMux provider row/icon. The status bar
model picker should treat ZenMux like other key-required cloud providers.

## Observability

No new logs. Harness story verification records source-level and typecheck
proof.

## Alternatives Considered

1. Use generic OpenAI-compatible configuration. Rejected because the supplied
   ZenMux endpoint is Anthropic Messages-compatible.
2. Implement manual fetch requests. Rejected because the existing AI SDK
   Anthropic provider already supports custom `baseURL` and `x-api-key` auth.
