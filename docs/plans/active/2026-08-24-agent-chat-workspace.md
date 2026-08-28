# Agent Chat Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Paseo-style chat presentation for locally installed CLI coding agents, with Settings as the only source of selectable agents.

**Architecture:** Introduce a deep `agent_chat` runtime module behind `start/send/cancel/close` Tauri commands. Runtime adapters translate provider-native Codex app-server, Claude/Gemini/Command Code headless JSON, OpenCode JSON events, and OMP RPC into one normalized event interface; the React surface consumes only that interface and never reads PTY screen text. Agent Chat setup follows the enabled Settings list, excluding Herdr (terminal-only), while the runtime reports provider/auth failures inline instead of leaving a silent loader.

**Tech Stack:** React 19, TypeScript, Tauri 2 IPC channels, Rust process management, serde/serde_json, Vitest, Rust unit tests.

---

### Task 1: Settings-derived chat provider registry

**Files:**
- Modify: `src/modules/terminal/lib/cliAgents.ts`
- Create: `src/modules/ai/lib/agentChatProviders.ts`
- Test: `src/modules/ai/lib/agentChatProviders.test.ts`

- [x] Write a failing test that supplies configured, disabled, installed, and adapter-capable IDs and expects only their intersection in Settings order.
- [x] Add `chatTransport?: "codex-app-server" | "claude-json"` to `CliAgentDefinition` and declare transport metadata only for verified Codex and Claude adapters.
- [x] Implement `resolveAgentChatProviders({ configuredIds, disabledIds, installedIds })` by composing `getEnabledCliAgentDefinitions()` with installed and transport filters; return definition objects, never copied labels.
- [x] Run `pnpm exec vitest run src/modules/ai/lib/agentChatProviders.test.ts --bail=1` and expect PASS.

### Task 2: Normalized runtime interface and adapter command construction

**Files:**
- Create: `src-tauri/src/modules/agent_chat/mod.rs`
- Create: `src-tauri/src/modules/agent_chat/adapter.rs`
- Create: `src-tauri/src/modules/agent_chat/events.rs`
- Create: `src-tauri/src/modules/agent_chat_test.rs`
- Modify: `src-tauri/src/modules/mod.rs`

- [x] Write Rust tests asserting exact launches for Codex (`app-server` JSON-RPC) and the locally installed Claude structured print contract (`--print --json`).
- [x] Define `AgentChatEvent` as a serde-tagged enum with `session`, `assistant`, `reasoning`, `tool`, `usage`, `error`, and `done` variants.
- [x] Define the internal adapter seam as `build_launch(provider, cwd) -> Result<LaunchSpec, AgentChatError>` and `parse_structured_line(adapter, line) -> Vec<AgentChatEvent>`; provider-native prompt/resume requests belong to the live runtime session in Task 3, not process launch.
- [x] Implement parsers using `serde_json::Value`; unknown valid events are ignored, malformed non-empty structured output produces an `error` event.
- [x] Run `cd src-tauri && cargo test agent_chat --locked` and expect PASS.

### Task 3: Tauri session lifecycle

**Files:**
- Modify: `src-tauri/src/modules/agent_chat/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/agent_chat_test.rs`

- [x] Test the public `AgentChatRuntime` provider validation plus provider protocol state machines: normalized session emission, follow-up reuse of native identity, and cancellation request construction. Real authenticated CLI processes remain outside unit tests.
- [x] Implement `AgentChatRuntime` with an `Arc<RwLock<HashMap<String, Arc<Session>>>>`; each session explicitly stores provider, cwd, native resume identity, event channel, and a cancellable provider backend.
- [x] Expose `agent_chat_start`, `agent_chat_send`, `agent_chat_cancel`, and explicit close commands using `tauri::ipc::Channel<AgentChatEvent>`; process stdout/stderr off the UI thread.
- [x] Register state and all commands in `lib.rs`; no new plugin or capability permission is needed for app-owned commands.
- [x] Run `cd src-tauri && cargo test agent_chat --locked` and expect PASS.

### Task 4: Persist agent-workspace identity

**Files:**
- Modify: `src-tauri/src/modules/db.rs`
- Modify: `src/app/App.tsx`
- Modify: `src/app/lib/useWorkspaceSelection.ts`
- Modify: `src/modules/workspaces/WorkspacesPanel.tsx`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Test: `src/app/lib/useWorkspaceSelection.test.ts`

- [x] Write a failing test proving an agent workspace restores its selected provider and resume identity into an `agent-chat` tab without creating a PTY.
- [x] Add nullable `agent_provider` and `agent_session_id` workspace columns with additive SQLite migration and serde camelCase fields.
- [x] Extend `AgentChatTab` and `WorkspaceRecord` with `provider`, provider-native `nativeSessionId`, and `cwd`; runtime process IDs remain ephemeral.
- [x] Make Agent Chat setup show one radio-card picker sourced from the Settings-derived provider list; remove the terminal-count/agent-allocation step for this mode.
- [x] Persist the chosen provider on workspace creation and restore the same provider/session when selecting the workspace.
- [x] Run the focused Vitest file and Rust DB tests; expect PASS.

### Task 5: Chat runtime hook and timeline projection

**Files:**
- Create: `src/modules/ai/lib/agentChatRuntime.ts`
- Create: `src/modules/ai/lib/agentChatTimeline.ts`
- Create: `src/modules/ai/lib/agentChatTimeline.test.ts`
- Create: `src/modules/ai/hooks/useAgentChatSession.ts`

- [x] Write reducer tests covering user submit, assistant streaming merge, reasoning, tool lifecycle, error, usage, provider replay context, and done.
- [x] Implement the stable-channel Tauri client with `start`, `send`, `cancel`, and `close` functions and typed normalized events.
- [x] Implement one timeline reducer whose public state is `{ items, status, error, usage, runtimeSessionId, nativeSessionId }`.
- [x] Implement `useAgentChatSession` to own hydration, single-flight submission, cancellation, cleanup, timeline persistence, provider replay, and native-session callbacks while keeping transport details out of React presentation components.
- [x] Run `pnpm exec vitest run src/modules/ai/lib/agentChatTimeline.test.ts --bail=1` and expect PASS.

### Task 6: Paseo-style chat presentation

**Files:**
- Replace implementation: `src/modules/ai/components/AgentChatWorkspace.tsx`
- Create: `src/modules/ai/components/AgentChatMessage.tsx`
- Create: `src/modules/ai/components/AgentChatToolRow.tsx`
- Test: `src/modules/ai/components/AgentChatWorkspace.source.test.ts`

- [x] Add provider model controls for the adapters that expose stable CLI flags (Codex `turn/start.model`, Gemini `--model`, OpenCode/Command Code model flags); providers without a reliable local catalog stay on their default until discovery is added.
- [x] Render user messages, assistant Markdown, collapsible reasoning/tool rows, inline errors, token usage, and a scroll-to-latest control from normalized timeline items.
- [x] Source provider icon/name from `CLI_AGENT_BY_ID`; remove `AGENT_OPTIONS`, the Codex default, and all fabricated welcome/activity messages.
- [x] Verify keyboard behavior: Enter sends, Shift+Enter inserts a line, and Escape cancels only while running.
- [x] Run focused component/source tests and expect PASS.

### Task 7: Verification and visual QA

**Files:**
- Update progress/results in this plan.

- [x] Run `pnpm exec vitest run src/modules/ai src/modules/workspaces src/app/lib/useWorkspaceSelection.test.ts --bail=1`.
- [x] Run `pnpm exec tsc --noEmit` and `pnpm build`.
- [x] Run `cd src-tauri && cargo check --all-targets --locked` and `cargo clippy --all-targets --locked -- -D warnings`.
- [ ] Render Agent Chat in light and dark themes, compare against the supplied Codex/Paseo references, and record a visual-verdict score of at least 90 with remaining differences documented.
- [ ] Confirm Standard and Canvas workspace creation, PTY cleanup, and existing workspace restoration remain unchanged.

## Follow-up: Native CLI session persistence

- [x] Preserve coding-agent launch commands for workspace panes in the existing SQLite pane records.
- [x] Resume only when provider and cwd identify exactly one native session; leave ambiguous panes unmodified.
- [x] Verify restore behavior and provider-specific resume command generation through focused frontend tests/build.
