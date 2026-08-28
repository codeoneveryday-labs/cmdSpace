# Execution Plan: Provider-Owned Agent Chat Runtime

Date: 2026-08-27

## Outcome

Each structured agent-chat provider owns its session lifecycle: launch, prompt
delivery, cancellation, durable-session validation, resume construction, and
history parsing. The shared Tauri runtime owns only workspace authorization,
session registration, event delivery, and cleanup.

## Evidence and constraint

Command Code v1.36.0 print mode currently creates `.meta.json` and checkpoint
sidecars while leaving the primary transcript empty. A `sessionId` reported by
that run is therefore not resumable. The shared print adapter must not claim a
provider-specific persistence guarantee that the provider has not established.

## Architecture

- Keep provider metadata in `src-tauri/src/modules/agent_chat/providers/`.
- Introduce one provider runtime module per supported structured provider.
- Define one small internal runtime interface for start, send, cancel, close,
  history loading, and resumability. Provider implementations hide protocol and
  persistence details behind it.
- Keep `AgentChatRuntime` as the lifecycle coordinator and preserve its Tauri
  command contract.
- Migrate providers in independent slices: Codex app-server, OMP RPC, Claude
  print, Gemini print, OpenCode print, and Command Code interactive/persistent
  transport once its durable protocol is verified.

## Provider policy

| Provider | Transport | Resume policy |
| --- | --- | --- |
| Codex | app-server | Native thread id after app-server confirmation |
| OMP | RPC | Provider-native session event only |
| Claude | print JSON | Native transcript + explicit `--resume <id>` |
| Gemini | stream JSON | No native resume until CLI contract is verified |
| OpenCode | JSON run | No native resume until CLI contract is verified |
| Command Code | Headless NDJSON | Provider-owned transcript materialization from `run_end.nextState`, then `--resume <id>` |

## Progress

- [x] Separate launch/model/control metadata into provider profile files.
- [x] Make Command Code print sessions fail closed when the transcript is not
      durable; do not persist a dead id.
- [ ] Extract the shared provider-runtime interface and move Codex/OMP behind
      it without behavior changes.
- [x] Upgrade the local Claude Code CLI and implement its documented print-mode
      JSON, durable transcript, native resume, history, and error contract.
- [ ] Move Gemini and OpenCode print transports behind their own modules with
      explicit non-resumable policies.
- [x] Implement Command Code's provider-owned durable headless transport:
      materialize the empty CLI transcript from `run_end.nextState`, then resume
      with the provider's documented `--resume <id>` contract.
- [ ] Add provider contract tests covering launch, durable identity, resume,
      cancellation, and history behavior.

## Verification

- Focused Rust provider-runtime tests per provider.
- `cargo clippy --all-targets --locked -- -D warnings`.
- `cargo check --all-targets --locked`.
- Focused frontend session lifecycle tests and `pnpm build`.
- Manual restart verification for each provider that advertises native resume.
