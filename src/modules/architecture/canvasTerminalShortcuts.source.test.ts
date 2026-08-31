import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./canvasTerminalShortcuts.ts", import.meta.url), "utf8");

describe("canvasTerminalShortcuts contract", () => {
  it("keeps platform keyboard mapping free of PTY effects", () => {
    expect(source).toContain("isTerminalCopy");
    expect(source).toContain("isTerminalPaste");
    expect(source).toContain("isDeletePreviousWord");
    expect(source).toContain("isDeleteToEndOfLine");
    expect(source).not.toContain("session.write");
  });
});
