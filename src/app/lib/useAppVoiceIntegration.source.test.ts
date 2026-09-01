import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppVoiceIntegration.ts", import.meta.url),
  "utf8",
);

describe("useAppVoiceIntegration contract", () => {
  it("keeps voice target routing and transcript insertion bound to real terminals", () => {
    expect(source).toContain("useAppVoiceIntegration");
    expect(source).toContain('kind: "canvas-terminal"');
    expect(source).toContain('kind: "terminal-pane"');
    expect(source).toContain("activeCanvasTerminalIds");
    expect(source).toContain("replaceCurrentInput(nextDraft)");
    expect(source).toContain("pendingVoiceDraftsRef.current.set");
    expect(source).toContain("package.json");
    expect(source).toContain("Cargo.toml");
    expect(source).toContain("developerVocabularyFromWorkspace");
  });
});
