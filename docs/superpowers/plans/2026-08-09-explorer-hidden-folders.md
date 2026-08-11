# Explorer Hidden Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted folder exclusion list that immediately filters the Editor sidebar.

**Architecture:** Store normalized directory basenames in the existing preferences store. Filter directory entries returned to `useFileTree`; keep the native filesystem API unchanged so the preference affects only the Editor Explorer.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri store/events, Vitest.

---

### Task 1: Pure exclusion behavior

**Files:**
- Create: `src/modules/explorer/lib/excludedFolders.ts`
- Create: `src/modules/explorer/lib/excludedFolders.test.ts`

- [x] Write tests showing normalization removes whitespace, blanks, and duplicates while preserving order.
- [x] Write tests showing only directory entries with exact matching basenames are filtered.
- [x] Run `pnpm vitest run src/modules/explorer/lib/excludedFolders.test.ts` and verify the missing implementation fails.
- [x] Implement `normalizeExcludedFolderNames`, `parseExcludedFolderNames`, and `filterExcludedFolders` with no glob or path matching.
- [x] Re-run the focused test and verify it passes.

### Task 2: Persist the preference

**Files:**
- Modify: `src/modules/settings/store.ts`
- Test: `src/settings/sections/GeneralSection.source.test.ts`

- [x] Add a failing source-contract assertion for `explorerExcludedFolderNames` and `setExplorerExcludedFolderNames`.
- [x] Add the preference type, default list, store key, normalized loading, setter, and cross-window event mapping.
- [x] Run the focused test and verify it passes.

### Task 3: Add the General Settings input

**Files:**
- Modify: `src/settings/sections/GeneralSection.tsx`
- Test: `src/settings/sections/GeneralSection.source.test.ts`

- [x] Add failing assertions for the visible label, helper text, Enter handling, and blur persistence.
- [x] Add a local draft synchronized from preferences and save it through the normalized setter.
- [x] Use a labeled text control with a concrete example placeholder and persistent helper text.
- [x] Run the focused test and verify it passes.

### Task 4: Filter and refresh Explorer nodes

**Files:**
- Modify: `src/modules/explorer/lib/useFileTree.ts`
- Modify: `src/modules/explorer/FileExplorer.source.test.ts`

- [x] Add failing assertions that `useFileTree` reads the preference, filters returned entries, and refreshes loaded directories when the list changes.
- [x] Filter `fs_read_dir` output with the pure helper and include the preference in the existing visibility refresh effect.
- [x] Run the focused tests and verify they pass.

### Task 5: Verify

- [x] Run the focused Explorer and Settings tests.
- [x] Run `pnpm test` and confirm zero failures.
- [x] Run `pnpm build` and confirm TypeScript and Vite production compilation succeed.
- [x] Run `git diff --check` and confirm no whitespace errors.
