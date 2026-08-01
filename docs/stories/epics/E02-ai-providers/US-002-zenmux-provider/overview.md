# Overview

## Current Behavior

cmdSpace has cloud providers such as Anthropic, OpenRouter, DeepSeek, and
Mistral, plus generic OpenAI-compatible and local providers. ZenMux is not
listed in Settings, key storage, model selection, or language-model creation.

## Target Behavior

Users can add a ZenMux API key in Settings, select the ZenMux `z-ai/glm-5.2`
model, and route AI requests through ZenMux's Anthropic-compatible Messages
endpoint.

## Affected Users

- Developers who want to use ZenMux-hosted models from cmdSpace.

## Affected Product Docs

- `docs/product/ai-providers.md`

## Non-Goals

- Add live model discovery from ZenMux.
- Add every ZenMux model up front.
- Change the generic OpenAI-compatible provider.
