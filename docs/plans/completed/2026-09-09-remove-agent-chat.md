# Remove Agent Chat Feature

**Date:** 2026-09-09
**Status:** complete
**Authorized by:** user request "xoá hẳn tính năng agent chat của dự án đi! mình không dùng nó nữa" + 3 scope confirmations (agent-chat only / keep agent_usage / drop DB schema).

## Objective

Remove the **agent-chat tab feature** end-to-end: the `agent-chat` tab kind, its
React components/hooks/lib, and the Rust `agent_chat` runtime daemon (CLI agent
sessions hosted in-process). Drop its SQLite surface (`agent_chat_configs`,
`agent_model_cache` tables, `agent_chat_ids` column).

## Keep (explicitly NOT deleted)

- Floating voice agent (`FloatingVoiceAgent`, `useHoldOptionToTalk`, voice lib,
  `keyring`, `config`, `native`, `proxyFetch`) — speech-to-text only.
- `agent_usage` module (terminal CLI-agent usage tracker + badge).
- Terminal CLI-agent detection (`cliAgents.ts`, `TerminalAgentSwitcher`,
  `FloatingTerminalOverlay` agent controls).
- Session import (`pty/session_import.rs`, `importSessions.ts`,
  `ImportSessionDialog`).

## Deletion surface

### Rust (`src-tauri/`)
- Delete `src/modules/agent_chat/` (whole dir), `agent_chat_test.rs`,
  `agent_chat_live_test.rs`.
- `mod.rs`: drop `pub mod agent_chat`, `mod agent_chat_test`,
  `mod agent_chat_live_test`.
- `lib.rs`: drop `agent_chat` from module list + `.manage(AgentChatRuntime::default())`.
- `commands.rs`: drop 9 `agent_chat_*` + `db_load/save_agent_chat_config` +
  `db_load/save_agent_model_cache`.
- `db.rs`: drop `mod agent_chat` + re-export block.
- Delete `db/agent_chat.rs` (all 4 commands are agent-chat-only).
- `db/models.rs`: drop `AgentChatConfigRow`, `AgentModelCacheRow`,
  `AgentModelCacheEntry`, `WorkspaceRow.agent_chat_ids`.
- `db/workspaces.rs`: drop `agent_chat_ids` from SELECT/INSERT/bindings.
- `db/schema.rs`: drop `agent_chat_ids` column, `agent_chat_configs` +
  `agent_model_cache` tables; add DROP migration for existing installs.
- `db/tests.rs`: drop agent-chat/agent_model_cache assertions.
- `agent_usage_scan/{omp,codex,cmd,claude}.rs`: relocate
  `agent_chat::find_resumable_session_file` helper into `agent_usage_scan` (keep usage tracker).
- `remote/runtime_creation.rs`, `remote/tests.rs`: drop `agent_chat_ids: None`.

### Frontend (`src/`)
- Tab system: drop `AgentChatTab` kind from `tabs/lib/tabTypes.ts` + `Tab` union;
  drop factory in `tabFactories.ts`; drop agent-chat branches in `tabPatchModel.ts`,
  `TabBarTabContent.tsx`, `useTabs.ts`, `useTabCreationActions.ts`.
- AI module: delete `AgentChatWorkspace`, `AgentChatHistory`, `AgentChatComposer`,
  `AgentChatOutlineRail`, `AgentTimeline`, `AgentUserPrompt`, `AgentAssistantMessage`,
  `AgentReasoningItem`, `AgentToolTimelineItem`, `AgentEditCard`, `AgentModelPicker`,
  `AgentSlashOptionPicker`, `AgentComposerActionBar`, `AgentComposerAttachments`,
  `AgentContextWindowMeter`, `AgentVoiceControls`, `AgentAttachmentPicker` (components);
  `useAgentChatSession`, `useAgentChatControls`, `useAgentChatSubmit`,
  `useAgentChatScroll`, `useAgentEditActions`, `useAgentEditSummary`,
  `useAgentAttachments`, `useAgentUsagePolling`, `useWorkspaceFiles` (hooks);
  `agentChatRuntime`, `agentChatTimeline`, `agentChatEdits`, `agentChatPromptModel`,
  `agentChatProviders`, `agentChatStartup`, `agentWorktree` (lib). Keep voice +
  `config` + `keyring` + `native` + `proxyFetch`.
- Voice: remove `agent-chat:${chatId}` target/owner variant from
  `voiceCaptureService.ts`, `voiceTranscriptInsertionModel.ts`, and any
  `appendVoiceTranscript` agent-chat glue; keep floating/terminal/editor targets.
- Workspace model: drop `agentChatIds`, `agentTabIds`, `agentProvider`,
  `agentSessionId`, `agentProviders`, `agentSessionIds` from
  `workspaceControllerTypes.ts` + every `src/app/lib/workspace*.ts` consumer;
  drop agent-mode workspace creation/restoration.
- Workspace setup: drop `workspaceMode === "agent"` path in
  `WorkspaceSetupView.tsx`, `WorkspaceSetupLayoutStep.tsx`,
  `useWorkspaceSetupAgentSelectionSync.ts`, `useWorkspaceSetupOpenWorkspace.ts`.

## Verification
- `cd src-tauri && cargo check --all-targets --locked`
- `pnpm exec tsc --noEmit`
- `pnpm test` / `cd src-tauri && cargo test`
- `pnpm build` + `cargo clippy --all-targets --locked -- -D warnings`

## Recovery
All deletions are git-tracked; recover with `git checkout -- <path>` before
committing. No commit until verification is green.

## Result

Removed the in-app Agent Chat feature across the Rust runtime, Tauri command
surface, SQLite persistence, React tab/workspace state, and chat-only UI.
Terminal CLI-agent detection, session import, usage tracking, and floating
voice input remain available. The workspace and canvas terminal controls now
keep their agent icon/state in sync and can switch back to a normal shell.

Validated on 2026-09-09 with `pnpm test` (443 files / 1215 tests plus 6 relay
tests), `pnpm exec tsc --noEmit`, `pnpm build`, `cargo check --all-targets
--locked`, `cargo test` (257 tests), and `cargo clippy --all-targets --locked
-- -D warnings`.
