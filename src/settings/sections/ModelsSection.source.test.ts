import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sectionPath = path.join(here, "ModelsSection.tsx");

describe("Voice settings section", () => {
  it("uses the CLI-agent catalog pattern for speech providers", () => {
    const section = readFileSync(sectionPath, "utf8");

    expect(section).toContain("STT model");
    expect(section).toContain("SpeechToTextRow");
    expect(section).toContain("Configured speech providers");
    expect(section).toContain("Add speech provider");
    expect(section).toContain("Search speech providers");
    expect(section).toContain("ConfiguredProviderRow");
    expect(section).toContain("CatalogProviderRow");
    expect(section).toContain("setSpeechToTextProviderIds");
    expect(section).toContain("setDisabledSpeechToTextProviderIds");
  });

  it("checks the selected STT provider and exposes a retryable status", () => {
    const section = readFileSync(sectionPath, "utf8");

    expect(section).toContain("probeSpeechToText");
    expect(section).toContain("STT ready");
    expect(section).toContain("Checking STT");
    expect(section).toContain("Retry");
    expect(section).toContain('aria-live="polite"');
  });
});
