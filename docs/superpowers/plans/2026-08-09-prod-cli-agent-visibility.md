# Production CLI Agent Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every CLI agent enabled in Settings appears in Workspace Setup in production, and persist the Custom CLI command in cmdSpace SQLite.

**Architecture:** Settings remains the authority for which catalog agents are enabled; executable detection is informational and must not filter Workspace Setup. A single-row SQLite preferences table stores the workspace setup Custom command, exposed through two existing Tauri IPC-style database commands and hydrated by the React setup view.

**Tech Stack:** React 19, TypeScript, Tauri 2 IPC, Rust, rusqlite, Vitest, Cargo tests.

---

### Task 1: Lock production agent visibility

**Files:**
- Modify: `src/modules/workspaces/WorkspacesPanel.test.ts`
- Modify: `src/modules/workspaces/WorkspacesPanel.tsx`

- [x] **Step 1: Write the failing frontend source regression**

Assert that Workspace Setup derives `availableAgents` directly from `configuredAgentCliOptions` and contains no `installedAgents`, `check_agent_clis`, or scanning-only branch.

- [x] **Step 2: Run the focused Vitest file and verify it fails**

Run: `pnpm vitest run src/modules/workspaces/WorkspacesPanel.test.ts`

Expected: FAIL because production executable detection still filters enabled agents.

- [x] **Step 3: Remove executable detection as a visibility gate**

Delete the Workspace Setup detection state/effect and render enabled configured agents directly. Keep installation detection in Settings, where it remains status information.

- [x] **Step 4: Run the focused Vitest file and verify it passes**

Run: `pnpm vitest run src/modules/workspaces/WorkspacesPanel.test.ts`

Expected: PASS.

### Task 2: Persist the Custom command in SQLite

**Files:**
- Modify: `src-tauri/src/modules/db.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/modules/workspaces/WorkspacesPanel.test.ts`
- Modify: `src/modules/workspaces/WorkspacesPanel.tsx`

- [x] **Step 1: Write failing persistence tests**

Add a Rust unit test that migrates an in-memory database, saves a Custom command, then reads the exact command back. Extend the frontend source regression to require load/save IPC calls.

- [x] **Step 2: Run focused Rust and frontend tests and verify failure**

Run: `cd src-tauri && cargo +stable test workspace_setup_custom_command --locked`

Run: `pnpm vitest run src/modules/workspaces/WorkspacesPanel.test.ts`

Expected: FAIL until the schema, helpers, commands, and hydration are implemented.

- [x] **Step 3: Add the minimal SQLite and Tauri contract**

Create `workspace_setup_preferences` with the fixed row `id = 1`; add borrowed-string save and `Result<String, String>` load helpers; expose `db_load_workspace_setup_custom_command` and `db_save_workspace_setup_custom_command` through the existing command registry.

- [x] **Step 4: Hydrate and save the input**

Load once when Workspace Setup mounts. Persist trimmed user edits after a short debounce and flush the current value on blur, without allowing the initial empty React state to overwrite SQLite before hydration finishes.

- [x] **Step 5: Run focused tests and verify they pass**

Run the two focused commands from Step 2. Expected: PASS.

### Task 3: Verify repository gates

**Files:**
- No additional files.

- [x] **Step 1: Run frontend tests and production build**

Run: `pnpm test && pnpm build`

- [x] **Step 2: Run Rust tests, check, and Clippy**

Run: `cd src-tauri && cargo +stable test --all-targets --locked && cargo +stable check --all-targets --locked && cargo +stable clippy --all-targets --locked -- -D warnings`

- [x] **Step 3: Review the final diff**

Confirm only the workspace setup UI/test, SQLite module, Tauri command registry, and this plan changed; preserve all pre-existing terminal and untracked user work.
