import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasTerminalInteractionModel.ts", import.meta.url),
  "utf8",
);

describe("canvasTerminalInteractionModel contract", () => {
  it("keeps terminal tab and drop decisions pure", () => {
    expect(source).toContain("resolveNextTerminalTabState");
    expect(source).toContain("resolveTerminalDropResult");
    expect(source).toContain('kind: "dock"');
    expect(source).toContain('kind: "detach"');
    expect(source).toContain('kind: "sync-frame"');
    expect(source).not.toContain("setNodes");
    expect(source).not.toContain("setTerminalDockGroups");
  });
});
