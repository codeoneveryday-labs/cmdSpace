import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SkillsLauncher.tsx", import.meta.url),
  "utf8",
);

describe("SkillsLauncher contract", () => {
  it("provides an accessible skills entry for the main workspace panel", () => {
    expect(source).toContain("export function SkillsLauncher");
    expect(source).toContain("Skill & Plugin");
    expect(source).toContain("onOpenSkills");
    expect(source).toContain('aria-label="Open skills catalog"');
    expect(source).toContain("SparklesIcon");
    expect(source).toContain('rounded-md bg-muted/65 px-2');
    expect(source).toContain('compact ? "px-3 py-2" : "px-4 py-2"');
  });
});
