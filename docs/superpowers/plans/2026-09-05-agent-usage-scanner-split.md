# Agent Usage Scanner Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Keep the external scanner seam stable and verify each extraction with the existing Rust regression suite.

**Goal:** Split provider-specific agent usage scanning out of `agent_usage_scan.rs` while preserving its Tauri command behavior, session isolation rules, and test coverage.

**Architecture:** Keep `agent_usage_scan.rs` as the orchestration module. Add one child module per provider (`codex`, `claude`, `omp`, `cmd`, and `opencode`) and leave shared file traversal, parser, model-window, and status construction helpers behind the parent module. The existing `agent_usage_opencode.rs` provider-wide database scanner remains separate and is renamed internally to avoid a module-name collision.

**Tech Stack:** Rust, Tauri commands, `serde_json`, `rusqlite`, existing unit tests.

---

### Task 1: Lock the module boundary

**Files:**
- Modify: `src-tauri/src/modules/agent_usage_scan.rs`
- Test: existing `src-tauri/src/modules/agent_usage_test.rs` and scanner isolation tests

- [x] Preserve `scan_agent_usage`, `scan_provider_limit_statuses`, and `scan_local_provider_limit_status` signatures.
- [x] Rename the existing `agent_usage_opencode.rs` child module internally to `opencode_provider` and reserve `opencode_scan` for the per-session scanner.
- [x] Keep shared helpers private to the scan module and expose only `pub(super)` provider functions.

### Task 2: Extract provider scanners

**Files:**
- Create: `src-tauri/src/modules/agent_usage_scan/codex.rs`
- Create: `src-tauri/src/modules/agent_usage_scan/claude.rs`
- Create: `src-tauri/src/modules/agent_usage_scan/omp.rs`
- Create: `src-tauri/src/modules/agent_usage_scan/cmd.rs`
- Create: `src-tauri/src/modules/agent_usage_scan/opencode.rs`
- Modify: `src-tauri/src/modules/agent_usage_scan.rs`

- [x] Move each provider's session scan and exact-session scan into its provider module.
- [x] Move Codex and Claude provider-wide limit scans to their corresponding modules.
- [x] Keep OpenCode SQLite session lookup in `opencode.rs`; keep the pre-existing provider-wide OpenCode scanner in `agent_usage_opencode.rs`.
- [x] Leave model-window lookup and `AgentUsageStatus` construction in the parent as shared implementation seams.

### Task 3: Preserve and run proof

**Files:**
- Modify: only tests if compilation exposes an import path that must be made explicit.

- [x] Run formatting checks on the extracted files.
- [x] Run `cargo test --locked -j1 agent_usage` (32 passed).
- [x] Run `cargo check --all-targets --locked`, focused frontend usage tests, `pnpm build`, and `git diff --check`.
- [x] Confirm no persistence, Tauri command, provider parser, or session-selection behavior changes.
