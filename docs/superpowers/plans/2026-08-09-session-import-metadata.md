# Session Import Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display short native session descriptions and relative activity times in the import picker.

**Architecture:** Extend the existing Rust JSONL parser to read the first Codex user message into the existing title/preview fields. Keep time formatting and presentation in a small TypeScript helper and the existing dialog component.

**Tech Stack:** Rust, serde_json, React 19, TypeScript, Vitest, Tauri v2

---

### Task 1: Parse Codex user-message metadata

**Files:**
- Modify: `src-tauri/src/modules/pty/session_import.rs`
- Test: `src-tauri/src/modules/pty/session_import.rs`

- [ ] Add a failing Rust test with `session_meta` followed by an `event_msg/user_message`, asserting the discovered title and preview use the message.
- [ ] Run `cargo test session_import --locked` and confirm the new assertion fails against the fallback title.
- [ ] Update `parse_codex_session` to collect metadata and the first non-empty user message in one streaming pass, then retain the existing fallback.
- [ ] Re-run the focused Rust tests and confirm they pass.

### Task 2: Format relative activity time

**Files:**
- Modify: `src/modules/workspaces/lib/importSessions.ts`
- Test: `src/modules/workspaces/lib/importSessions.test.ts`

- [ ] Add failing tests for minutes, hours, and days using an explicit `now` argument.
- [ ] Run the focused Vitest file and confirm the missing formatter fails.
- [ ] Implement `formatRelativeActivity(timestamp, now)` with compact English units and an `Unknown activity` fallback.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Match the compact session-row layout

**Files:**
- Modify: `src/modules/workspaces/ImportSessionDialog.tsx`
- Test: `src/modules/workspaces/ImportSessionDialog.source.test.ts`

- [ ] Add failing source assertions for the shared relative-time helper and single-line title/preview truncation.
- [ ] Run the focused source test and confirm failure.
- [ ] Move relative time to the row's right column, retain directory as the third line, and keep selection/active status accessible.
- [ ] Run focused frontend tests and inspect the dev dialog visually.

### Task 4: Verify

**Files:**
- Verify only

- [ ] Run `pnpm test`, `pnpm build`, Rust session tests, Cargo check, Clippy with warnings denied, and `git diff --check`.
- [ ] Confirm long content truncates visually and actual Codex titles replace fallback IDs in the dev picker.
