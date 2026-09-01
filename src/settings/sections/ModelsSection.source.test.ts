import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sectionPath = path.join(here, "ModelsSection.tsx");
const healthHookPath = path.join(here, "useSpeechToTextHealth.ts");

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
    expect(section).toContain("Key saved · unavailable");
    expect(section).toContain("!model.developmentOnly");
    expect(section).toContain("setSpeechToTextProviderIds");
    expect(section).toContain("setDisabledSpeechToTextProviderIds");
  });

  it("checks the selected STT provider and exposes a retryable status", () => {
    const section = readFileSync(sectionPath, "utf8");
    const healthHook = readFileSync(healthHookPath, "utf8");
    const source = `${section}\n${healthHook}`;

    expect(source).toContain("probeSpeechToText");
    expect(source).toContain("STT ready");
    expect(source).toContain("Checking STT");
    expect(source).toContain("Retry");
    expect(source).toContain('aria-live="polite"');
  });
});
