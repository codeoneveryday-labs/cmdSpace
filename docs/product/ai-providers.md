# AI Providers

cmdSpace supports first-party model providers, gateways, OpenAI-compatible
endpoints, and local model servers. Cloud providers that need a key store that
key in the OS keychain under `cmdspace-ai`.

Provider keys are cached in memory after the first successful keychain read or
write during an app session. The OS keychain remains the source of truth, but
the session cache prevents repeated macOS keychain prompts while the same app
process is running.

## ZenMux

ZenMux is supported as an Anthropic-compatible provider. It uses:

- Base URL: `https://zenmux.ai/api/anthropic/v1`
- Messages endpoint: `/v1/messages`
- API key header: `x-api-key`
- Anthropic API version: `2023-06-01`
- Initial curated model: `z-ai/glm-5.2`

The provider is intentionally separate from the generic OpenAI-compatible
provider because ZenMux's example uses the Anthropic Messages protocol, not
OpenAI chat completions.
