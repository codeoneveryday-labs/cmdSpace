# Claude Code Agent Chat Compatibility

Date: 2026-08-28

## Local CLI baseline

The installed `claude --version` reports `0.2.57`. Its local help exposes only
`--print`, `--json`, and a small legacy flag set. It does not expose the modern
session and streaming flags required for a full provider integration.

## Current official contract

The official Claude Code CLI reference documents:

- `claude -p --resume <session-id> <prompt>` for a print-mode follow-up.
- `--output-format stream-json` for structured streamed events.
- `--fallback-model` for explicit availability fallback chains.
- `--no-session-persistence` as the opt-out for durable print-mode transcripts.

The session documentation states that print-mode sessions remain resumable by
explicit ID, and that Claude stores JSONL transcripts under
`~/.claude/projects/<project>/<session-id>.jsonl`.

Sources:

- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/sessions
- https://code.claude.com/docs/en/errors

## Consequence

Do not mark Claude as fully supported or switch the app to the modern contract
until the local Claude Code CLI is upgraded to a version that exposes these
flags. The existing legacy `--print --json` adapter may remain available as a
non-full provider until then.
