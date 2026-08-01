# Editor Explorer Shift Multi-Select Implementation Plan

**Goal:** Let the Editor file tree select contiguous files and folders with Shift, then open selected files or delete selected entries in one action.

**Architecture:** Keep selection state in `FileExplorer`, because the selectable order is the flattened visible row order. Extract pure range and deletion-normalization helpers into `src/modules/explorer/lib/selection.ts` so the interaction rules are testable without rendering React. Extend `useFileTree` with a batch delete operation and keep ordinary single-click behavior unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Vitest, Tauri `invoke` filesystem commands.

### Tasks

- [x] Add failing unit tests for visible-row range selection and parent/descendant normalization.
- [x] Implement the pure selection helpers and make the tests pass.
- [x] Replace `selectedPath` with multi-selection plus anchor/focus handling in `FileExplorer`.
- [x] Add selected-row styling, selection summary/action controls, Escape/blank-area clearing, and bulk open/delete wiring.
- [x] Add `deletePaths` to `useFileTree` with parent-first deduplication and refresh callbacks.
- [x] Run focused tests, full tests, and the production build; inspect the final diff for unrelated changes.
