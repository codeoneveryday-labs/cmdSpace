import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./TerminalPreferencesSection.tsx", import.meta.url),
  "utf8",
);

describe("TerminalPreferencesSection contract", () => {
  it("owns shell, renderer, typography, scrollback and Space settings", () => {
    expect(source).toContain("export function TerminalPreferencesSection");
    expect(source).toContain("Default shell");
    expect(source).toContain("Use WebGL renderer");
    expect(source).toContain("Copy selected text");
    expect(source).toContain("Scrollback");
  });
});
