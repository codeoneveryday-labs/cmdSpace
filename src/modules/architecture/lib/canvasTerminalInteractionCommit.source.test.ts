import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasTerminalInteractionCommit.ts", import.meta.url),
  "utf8",
);

describe("canvasTerminalInteractionCommit contract", () => {
  it("keeps terminal drop and group-close mutations behind one seam", () => {
    expect(source).toContain("commitTerminalDropResult");
    expect(source).toContain("commitTerminalGroupClose");
    expect(source).toContain("setNodes");
    expect(source).toContain("setTerminalDockGroups");
    expect(source).toContain("pushHistory");
  });
});
