import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useSpeechToTextHealth.ts", import.meta.url),
  "utf8",
);

describe("useSpeechToTextHealth contract", () => {
  it("owns STT probe, staged fallback, retry, and cancellation", () => {
    expect(source).toContain("probeSpeechToText");
    expect(source).toContain("setSpeechToTextModelId");
    expect(source).toContain("healthCheckAttempt");
    expect(source).toContain("disposed");
    expect(source).toContain('state: "unavailable"');
  });
});
