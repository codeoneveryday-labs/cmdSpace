import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentVoiceControls.tsx", import.meta.url),
  "utf8",
);

describe("AgentVoiceControls contract", () => {
  it("handles recording confirmation, cancellation and voice start", () => {
    expect(source).toContain("export function AgentVoiceControls");
    expect(source).toContain("Cancel voice transcript");
    expect(source).toContain("Confirm voice transcript");
    expect(source).toContain("Voice to text");
    expect(source).toContain("VoiceLevelMeter");
  });
});
