# Router-for.me CLIProxyAPI Research

Date: 2026-09-02

## Summary

CLIProxyAPI is an OpenAI-compatible gateway/proxy for AI coding clients. Its official OpenCode integration configures OpenCode with a provider `baseURL` ending in `/v1` and selects a model through `provider/model`.

## Quick Start

The official quick-start page documents macOS installation through Homebrew:

```bash
brew install cliproxyapi
brew services start cliproxyapi
```

The default Homebrew config path is `$(brew --prefix)/etc/cliproxyapi.conf`. The project also documents Linux, Docker, Windows, and source-build paths.

## OpenCode Integration

The official OpenCode page uses this shape:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "options": {
        "baseURL": "http://127.0.0.1:8317/v1",
        "apiKey": "sk-dummy"
      }
    }
  },
  "model": "gpt-5.3-codex"
}
```

For a remote gateway, the equivalent base URL is the provider URL plus `/v1`. In this workspace, OpenCode is configured with the custom provider `9aws`, `https://api.9aws.net/v1`, and an environment-backed key reference.

## OpenAI Compatibility

CLIProxyAPI's OpenAI compatibility layer accepts configured upstream providers, API key entries, and model mappings. Its documented request surface is `/v1/chat/completions`.

## Important Distinction

CLIProxyAPI is a proxy layer, not a way to change the backend endpoint of the official Kiro CLI. OpenCode can consume the proxy because OpenCode supports custom OpenAI-compatible providers.

## Security Notes

- Do not commit API keys in `opencode.json` or proxy configuration files.
- Prefer OpenCode environment substitution or its credential store.
- Bind locally when running a local proxy unless remote access is explicitly required.
- Change default admin credentials before exposing a proxy beyond localhost.

## Sources

- https://help.router-for.me/introduction/quick-start
- https://help.router-for.me/agent-client/opencode
- https://help.router-for.me/configuration/provider/openai-compatibility
