# Codex CLI usage, quota, and token data research

Research date: 2026-08-10. Sources: ChatGPT Learn docs and the `openai/codex` `main` branch.

## Direct answer

- Yes. The supported integration path is the local `codex app-server` JSON-RPC 2.0 API over stdio by default, plus `codex exec --json` for one-off command execution. The documented account endpoints include `account/usage/read` for ChatGPT token-activity summary and daily buckets, `account/rateLimits/read` for quota state, and `thread/tokenUsage/updated` for live/restored per-thread token usage.
- I did not find a separate public REST endpoint for these metrics in the docs I reviewed. The supported surface is the local JSON-RPC protocol, not parsing internal files.

## Official docs evidence

- [Authentication](https://learn.chatgpt.com/docs/auth) - documents `codex login --with-api-key` and `codex login --with-access-token`; API keys are recommended for programmatic CLI workflows, and access tokens are for trusted scripts, schedulers, and private CI runners with ChatGPT workspace/enterprise needs.
- [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) - documents `history.persistence` and says Codex can save session transcripts to `history.jsonl`.
- [codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) - documents JSON-RPC 2.0 over stdio by default and lists the stable account/thread methods, including `account/rateLimits/read`, `account/usage/read`, `thread/tokenUsage/updated`, and `turn/completed`.

## Source-reference evidence

- [core config](https://github.com/openai/codex/blob/main/codex-rs/core/src/config/mod.rs#L3591-L3698) - `CODEX_HOME` defaults to `~/.codex`, CLI auth credentials can be stored in file/keyring/auto mode, and log files default to `$CODEX_HOME/log`.
- [auth docs](https://learn.chatgpt.com/docs/auth) - credentials are cached in `~/.codex/auth.json` or the OS credential store; direct `codex login` writes `codex-login.log` under the configured log directory.
- [message history](https://github.com/openai/codex/blob/main/codex-rs/message-history/src/lib.rs#L1165-L1288) - history is written to `~/.codex/history.jsonl`.
- [rollout list source](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/list.rs#L2808-L2938) - session threads are discovered under `~/.codex/sessions`, with the nested on-disk layout `YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl`.
- [exec JSON output](https://github.com/openai/codex/blob/main/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L1627-L1668) and [turn completion usage](https://github.com/openai/codex/blob/main/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L2375-L2418) - `codex exec --json` prints JSON events and emits `TurnCompletedEvent.usage` with `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, and `reasoning_output_tokens`.

## Version note

- Evidence comes from the current `main` branch and docs crawled on 2026-08-10. File paths, event names, and method sets may drift in later releases.

## Caveats / ambiguity flags

- The docs confirm the presence of `account/usage/read` and `account/rateLimits/read`, but they do not fully spell out the response schema in the pages reviewed here.
- The docs do not advertise a separate public REST endpoint for quota/usage. The documented integration path is the local app-server JSON-RPC surface.
- `~/.codex/history.jsonl`, `~/.codex/sessions/...`, and `~/.codex/auth.json` are observable persistence locations, but they are implementation details. Prefer the documented API/event surfaces unless you explicitly want to couple to internal storage.

## Reusable takeaway

Use `codex app-server` over stdio plus the documented account/thread methods for quota and token telemetry; use `codex exec --json` for per-run usage; use API keys for programmatic local workflows and access tokens only for trusted automation that needs ChatGPT workspace or enterprise access.
