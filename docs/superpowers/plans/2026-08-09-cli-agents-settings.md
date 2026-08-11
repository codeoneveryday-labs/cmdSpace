# CLI Agents Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Settings persona management with a persistent Paseo-style CLI agent catalog that controls Workspace Setup availability.

**Architecture:** Extend the existing typed CLI registry with catalog metadata and pure selection helpers. Persist configured and disabled ids through the existing settings store, render them in a new Settings section, and filter Workspace Setup through the same helpers.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri v2 Store and IPC, Vitest, Tailwind CSS.

---

### Task 1: Lock registry behavior

**Files:**
- Modify: `src/modules/terminal/lib/cliAgents.test.ts`
- Modify: `src/modules/terminal/lib/cliAgents.ts`

- [ ] Add failing tests for id normalization, catalog search, default configured ids, and disabled filtering.
- [ ] Run `pnpm vitest run src/modules/terminal/lib/cliAgents.test.ts` and confirm the missing exports fail.
- [ ] Add typed metadata and pure helpers, then rerun the focused test.

### Task 2: Persist configuration

**Files:**
- Modify: `src/modules/settings/store.ts`

- [ ] Add `cliAgentIds` and `disabledCliAgentIds` to preferences, defaults, loading, setters, and cross-window event mapping.
- [ ] Normalize stored values through the CLI registry so stale ids never reach UI consumers.

### Task 3: Replace Settings UI

**Files:**
- Create: `src/settings/sections/CliAgentsSection.tsx`
- Create: `src/settings/sections/CliAgentsSection.test.ts`
- Modify: `src/settings/SettingsApp.tsx`

- [ ] Add source tests requiring the `CLI Agents` tab, local executable scan, add/search/toggle UI, and absence of the old `AgentsSection` import.
- [ ] Implement configured rows, installation status, toggles, install links, catalog search, and Add actions.

### Task 4: Connect Workspace Setup

**Files:**
- Modify: `src/modules/workspaces/WorkspacesPanel.tsx`
- Modify: `src/modules/workspaces/WorkspacesPanel.test.ts`

- [ ] Add a failing source assertion for shared enabled-agent filtering.
- [ ] Filter Workspace Setup choices and selected counts using configured enabled agents while retaining all-agent command recognition.

### Task 5: Verify

- [ ] Run focused Vitest coverage for CLI registry, Settings, Workspace Setup, and preferences source contracts.
- [ ] Run `pnpm build`.
- [ ] Inspect the final diff and confirm unrelated terminal IME changes remain untouched.
