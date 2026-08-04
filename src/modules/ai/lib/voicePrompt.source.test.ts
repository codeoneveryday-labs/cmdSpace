import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVoicePromptContext, createFallbackVoiceDraft } from "./voicePrompt";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/ai/lib/voicePrompt.ts"),
  "utf8",
);

describe("voice prompt refinement", () => {
  it("asks the model to compile spoken requests into First Mate task kinds", () => {
    expect(source).toContain("generateText");
    expect(source).toContain('{"kind":"ship","text":"..."}');
    expect(source).toContain('{"kind":"scout","text":"..."}');
    expect(source).not.toContain('{"kind":"clarification","text":"..."}');
    expect(source).toContain("Voice First Mate");
    expect(source).toContain("Do not execute commands");
    expect(source).toContain("maxOutputTokens: VOICE_PROMPT_MAX_OUTPUT_TOKENS");
    expect(source).toContain("AbortSignal.timeout(PROMPT_GENERATION_TIMEOUT_MS)");
  });

  it("always produces a terminal draft instead of a clarification question", () => {
    expect(source).toContain("type VoicePromptResult");
    expect(source).toContain("parseVoicePromptResult");
    expect(source).not.toContain('kind: "clarification"');
    expect(source).toContain("createFallbackVoiceDraft");
    expect(createFallbackVoiceDraft("Fix the terminal resize bug")).toEqual({
      kind: "ship",
      text: "Implement the requested change: Fix the terminal resize bug",
    });
  });

  it("keeps implementation requests actionable without repeated clarification", () => {
    expect(source).toContain(
      "Do not ask for clarification merely because a software request is underspecified",
    );
    expect(source).toContain(
      'Use "ship" for build, add, create, implement, change, update, or fix work',
    );
    expect(source).toContain(
      "inspect the relevant codebase and make the smallest coherent implementation",
    );
  });

  it("does not make users restate a described feature to choose implementation details", () => {
    expect(source).toContain(
      "Never make the user restate a described feature to choose implementation details",
    );
    expect(source).toContain(
      "Always return a draft, even when the transcript is vague or conversational",
    );
  });

  it("falls back to a safe ship draft when the model output is malformed", () => {
    expect(source).toContain("return parsed ?? createFallbackVoiceDraft(transcript);");
    expect(source).not.toContain("VOICE_TASK_RECOVERY_SYSTEM");
  });

  it("requires a detailed, terminal-safe brief that never embeds the raw speech", () => {
    expect(source).toContain("one-paragraph task brief");
    expect(source).toContain("90–180 words");
    expect(source).toContain("with no Markdown");
    expect(source).toContain("never replace Next.js with HTML");
    expect(source).toContain(
      "Do not add conventional sections, quality goals, or implementation details",
    );
    expect(source).toContain("Never quote, prefix, append, or otherwise include the raw transcript");
    expect(source).toContain(
      "Do not choose a programming language, framework, database, or deployment approach that the speaker did not name.",
    );
    expect(source).toContain('.replace(/\\s+/g, " ")');
  });

  it("treats speech recognition as noisy input and corrects obvious coding terms", () => {
    expect(source).toContain("noisy speech-recognition input");
    expect(source).toContain("only when the intended technical term is clear");
    expect(source).toContain("user intent and the available workspace context");
    expect(source).not.toContain('"red chest" as "React JS"');
  });

  it("does not depend on a manually selected transcript language", () => {
    expect(source).not.toContain("speechLanguage");
    expect(source).not.toContain("Transcription language:");
  });

  it("uses recent drafts as hidden context while keeping follow-up terminal input incremental", () => {
    expect(source).toContain("short-term working memory for this terminal");
    expect(source).toContain(
      "write only the newly requested change as an incremental follow-up brief",
    );
    expect(source).toContain(
      "Do not repeat the prior brief, its technologies, requirements, or validation",
    );
  });

  it("treats the latest speech as authoritative and keeps saved drafts out of terminal context", () => {
    const previousDraft =
      "Create a React portfolio with a progress bar feature for storytelling.";
    const context = buildVoicePromptContext({
      terminalContext: `shell output\n${previousDraft}\nagent output after the draft`,
      recentDrafts: [previousDraft],
    });

    expect(context).toContain("Spoken request is authoritative over history");
    expect(context).toContain("agent output after the draft");
    expect(context).not.toContain(`Recent terminal state:\n${previousDraft}`);
    expect(source).toContain(
      "Never carry a feature, technology, or requirement from history",
    );
  });

  it("keeps the spoken transcript transient and uses it only in the fallback draft", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).toContain("Implement the requested change:");
  });
});
