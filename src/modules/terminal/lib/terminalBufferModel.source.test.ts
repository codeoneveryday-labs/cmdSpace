import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terminalBufferModel.ts", import.meta.url), "utf8");

describe("terminalBufferModel contract", () => {
  it("owns ANSI stripping and bounded tail normalization", () => {
    expect(source).toContain("tailTerminalLines");
    expect(source).toContain("tailTerminalSnapshot");
    expect(source).toContain("ANSI_RE");
    expect(source).toContain("slice(-maxLines)");
  });
});
