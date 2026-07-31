# Voice First Mate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn spoken coding requests into compact, context-aware task briefs for the active CLI agent.

**Architecture:** Keep speech capture and terminal draft insertion unchanged. Replace the current rewrite-only model contract with a small task compiler that classifies `ship`, `scout`, or `clarification`; it uses the captured cwd and redacted terminal context only to ground a compact but implementation-ready brief. The active terminal receives only that brief, never the raw transcript.

**Tech Stack:** React, TypeScript, Vercel AI SDK, Vitest.

---

### Task 1: Lock the Voice First Mate task contract

**Files:**
- Modify: `src/modules/ai/lib/voicePrompt.source.test.ts`
- Test: `src/modules/ai/lib/voicePrompt.source.test.ts`

- [x] **Step 1: Write the failing source-contract assertions**

Assert that the model contract emits `ship`, `scout`, and `clarification`; treats build/fix work as `ship`; permits `scout` only for an explicit investigation; and never includes the raw transcript in the CLI brief.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run src/modules/ai/lib/voicePrompt.source.test.ts`

Expected: FAIL because the current contract only accepts `draft` and `clarification`.

### Task 2: Compile spoken requests into terminal-safe task briefs

**Files:**
- Modify: `src/modules/ai/lib/voicePrompt.ts`
- Test: `src/modules/ai/lib/voicePrompt.source.test.ts`

- [x] **Step 1: Implement the typed result and parser**

Accept only `{ kind: "ship" | "scout" | "clarification", text: string }`, strip formatting and line breaks, and retain the existing safe clarification fallback for malformed model output.

- [x] **Step 2: Replace the model instruction**

Instruct the model to operate as a first mate: compile a concise English brief from the spoken request plus cwd and recent terminal context; use `ship` for build/fix/change work, `scout` only when the speaker explicitly asks to inspect or diagnose, and `clarification` only when there is no task objective. Keep the brief to one paragraph and do not quote the transcript.

- [x] **Step 3: Run the focused test and verify it passes**

Run: `pnpm vitest run src/modules/ai/lib/voicePrompt.source.test.ts`

Expected: PASS.

### Task 3: Preserve the review-before-send Voice UX

**Files:**
- Modify: `src/modules/ai/hooks/useVoicePromptAgent.ts`
- Modify: `src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
- Modify: `docs/product/ai-helper.md`
- Test: `src/modules/ai/components/FloatingVoiceAgent.source.test.ts`

- [x] **Step 1: Update the hook to handle both task kinds as drafts**

Insert `ship` and `scout` briefs into the captured pane without a carriage return; retain clarification in the pill only.

- [x] **Step 2: Update contract tests and docs**

Describe Voice as a first-mate task compiler, not a Prompt Engineer rewrite. Confirm raw audio, transcript, and draft remain transient.

- [x] **Step 3: Run focused tests and typecheck**

Run: `pnpm vitest run src/modules/ai/lib/voicePrompt.source.test.ts src/modules/ai/components/FloatingVoiceAgent.source.test.ts && pnpm exec tsc --noEmit`

Expected: PASS.
