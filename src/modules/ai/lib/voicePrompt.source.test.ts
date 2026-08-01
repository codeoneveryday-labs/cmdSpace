import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVoicePromptContext, shouldRecoverTaskDraft } from "./voicePrompt";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/ai/lib/voicePrompt.ts"),
  "utf8",
);

describe("voice prompt refinement", () => {
  it("asks the model to compile spoken requests into First Mate task kinds", () => {
    expect(source).toContain("generateText");
    expect(source).toContain('{"kind":"ship","text":"..."}');
    expect(source).toContain('{"kind":"scout","text":"..."}');
    expect(source).toContain('{"kind":"clarification","text":"..."}');
    expect(source).toContain("Voice First Mate");
    expect(source).toContain("Do not execute commands");
    expect(source).toContain("maxOutputTokens: VOICE_PROMPT_MAX_OUTPUT_TOKENS");
    expect(source).toContain("AbortSignal.timeout(PROMPT_GENERATION_TIMEOUT_MS)");
  });

  it("keeps greetings out of the active terminal", () => {
    expect(source).toContain("type VoicePromptResult");
    expect(source).toContain("parseVoicePromptResult");
    expect(source).toContain('kind: "clarification"');
    expect(source).toContain("there is no coding task objective");
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
      "Clarification is forbidden once the transcript identifies a requested feature, behavior, defect, workflow, screen, or output",
    );
  });

  it("recompiles a detailed request but never invents a generic task after clarification", () => {
    expect(
      shouldRecoverTaskDraft(
        "Could you help me create a Next.js portfolio website with a login flow?",
        "clarification",
      ),
    ).toBe(true);
    expect(shouldRecoverTaskDraft("Hello", "clarification")).toBe(false);
    expect(
      shouldRecoverTaskDraft(
        "Could you help me create a Next.js portfolio website with a login flow?",
        "ship",
      ),
    ).toBe(false);
    expect(source).toContain("The first pass incorrectly asked the user a question");
    expect(source).not.toContain("DEFAULT_TASK_RECOVERY");
    expect(source).toContain("return recovered;");
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

  it("keeps the spoken transcript transient and never creates a fallback draft", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("Build the requested feature:");
  });
});
