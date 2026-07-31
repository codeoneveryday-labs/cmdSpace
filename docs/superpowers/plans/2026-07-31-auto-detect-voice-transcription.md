# Automatic Voice Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voice use multilingual automatic transcription when an OpenAI key is configured while retaining working native speech recognition without one.

**Architecture:** Keep the existing native speech bridge as the unconditional fallback. Add a browser audio-capture path that uploads the recording to OpenAI's `gpt-4o-transcribe` endpoint without a `language` hint, then feeds its transcript through the existing Voice First Mate flow. The settings surface no longer stores or exposes a selected language.

**Tech Stack:** React, TypeScript, MediaRecorder, OpenAI Audio Transcriptions API, existing Tauri native speech bridge, Vitest.

---

### Task 1: Lock automatic-selection behavior with source regression tests

**Files:**
- Modify: `src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
- Modify: `src/settings/sections/GeneralSection.source.test.ts`

- [x] **Step 1: Write the failing test**

Require voice recording to accept an OpenAI key, call the transcription endpoint with `gpt-4o-transcribe`, omit a language field, and fall back to `speech_start` when no key exists. Require settings to have no Voice language selector or persisted `voiceLanguage` preference.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/ai/components/FloatingVoiceAgent.source.test.ts src/settings/sections/GeneralSection.source.test.ts`

Expected: FAIL because the current native bridge uses a user-selected locale and has no OpenAI transcription path.

### Task 2: Add automatic cloud transcription with native fallback

**Files:**
- Modify: `src/modules/ai/hooks/useWhisperRecording.ts`
- Modify: `src/modules/ai/hooks/useVoicePromptAgent.ts`
- Modify: `src/modules/ai/lib/composer.tsx`

- [x] **Step 1: Implement the smallest recording mode switch**

Use `MediaRecorder` and `getUserMedia` only when a non-empty OpenAI key and supported browser recording APIs are present. Submit the resulting audio blob to `https://api.openai.com/v1/audio/transcriptions` as multipart form data with `model=gpt-4o-transcribe`; do not submit a `language` value. If cloud capture cannot start, begin the existing native session immediately. If transcription fails after recording, mark cloud unavailable so the next attempt uses native speech. Without a key, start the existing native session immediately.

- [x] **Step 2: Thread the existing OpenAI key to both voice entry points**

Pass `keys.openai` from the floating voice agent and composer to `useWhisperRecording`; retain its existing result/error contract so Voice First Mate and the AI composer receive the same transcript flow.

- [x] **Step 3: Run focused tests**

Run: `pnpm vitest run src/modules/ai/components/FloatingVoiceAgent.source.test.ts src/settings/sections/GeneralSection.source.test.ts`

Expected: PASS.

### Task 3: Remove manual language configuration

**Files:**
- Modify: `src/modules/settings/store.ts`
- Modify: `src/settings/sections/GeneralSection.tsx`
- Modify: `src/modules/ai/lib/voicePrompt.ts`

- [x] **Step 1: Remove preference and selector**

Delete the Voice language option types, fallback option list, persisted key, load/save setter, and General settings selector. Keep the floating voice toggle.

- [x] **Step 2: Remove language metadata from voice prompt compilation**

Delete `speechLanguage` from the voice prompt options and context, because automatic transcription does not supply a trustworthy manually selected locale.

- [x] **Step 3: Run project validation**

Run: `pnpm vitest run src/modules/ai/components/FloatingVoiceAgent.source.test.ts src/settings/sections/GeneralSection.source.test.ts src/modules/ai/lib/voicePrompt.source.test.ts && pnpm build && git diff --check`

Expected: all selected tests and build pass; no whitespace errors.
