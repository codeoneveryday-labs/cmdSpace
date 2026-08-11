# Provider and Agent Brand Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display Paseo's locally vendored brand artwork consistently across provider selectors, workspace agent setup, and terminal agent headers.

**Architecture:** A shared catalog maps stable brand IDs to local SVG assets. `ProviderIcon` and `AgentCliIcon` resolve their domain IDs into that catalog and retain existing generic fallbacks.

**Tech Stack:** React 19, TypeScript, Vite SVG asset imports, Vitest, Tailwind CSS.

---

### Task 1: Lock icon resolution behavior

**Files:**
- Create: `src/components/brandIcons.test.ts`
- Create: `src/components/brandIcons.ts`

- [ ] Write tests asserting OpenAI/Anthropic/Google/xAI/Mistral provider mappings and known coding-agent mappings.
- [ ] Run `pnpm vitest run src/components/brandIcons.test.ts` and confirm failure because the catalog does not exist.
- [ ] Implement the smallest typed resolver maps and rerun the test.

### Task 2: Vendor and render Paseo artwork

**Files:**
- Create: `src/assets/provider-icons/*.svg`
- Create: `src/components/BrandIcon.tsx`
- Modify: `src/settings/components/ProviderIcon.tsx`
- Modify: `src/modules/ai/components/AiStatusBarControls.tsx`
- Modify: `src/modules/terminal/AgentCliIcon.tsx`

- [ ] Copy the required SVG artwork from Paseo into the local asset directory.
- [ ] Render assets through a shared CSS-mask component with `currentColor` behavior.
- [ ] Route provider surfaces through `ProviderIcon` and agent surfaces through `AgentCliIcon`.
- [ ] Reduce provider and agent badge artwork to the approved compact sizes.

### Task 3: Verify every consumer

**Files:**
- Modify: `src/modules/ai/config.source.test.ts`
- Modify: `src/modules/terminal/PaneTreeView.test.ts`
- Modify: `src/modules/workspaces/WorkspacesPanel.test.ts`

- [ ] Update source assertions to require shared icon components rather than duplicated Hugeicons maps.
- [ ] Run focused Vitest coverage.
- [ ] Run `pnpm build` and inspect the final diff for unrelated changes.
