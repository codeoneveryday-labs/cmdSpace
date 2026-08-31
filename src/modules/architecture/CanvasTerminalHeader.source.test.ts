import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CanvasTerminalHeader.tsx", import.meta.url), "utf8");

describe("CanvasTerminalHeader contract", () => {
  it("owns tabs and terminal group controls", () => {
    expect(source).toContain("export function CanvasTerminalHeader");
    expect(source).toContain("Canvas terminal tabs");
    expect(source).toContain("Add terminal tab");
    expect(source).toContain("Close terminal group");
  });
});
