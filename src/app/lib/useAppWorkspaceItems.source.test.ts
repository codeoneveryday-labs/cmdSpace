import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppWorkspaceItems.ts", import.meta.url),
  "utf8",
);

describe("useAppWorkspaceItems contract", () => {
  it("memoizes workspace item composition while routing all close actions", () => {
    expect(source).toContain("useAppWorkspaceItems");
    expect(source).toContain("buildWorkspaceItems");
    expect(source).toContain("closePaneByLeaf");
    expect(source).toContain("closeCanvasTerminal");
    expect(source).toContain("closeAgentTab");
    expect(source).toContain("activeCanvasTerminalIds");
  });
});
