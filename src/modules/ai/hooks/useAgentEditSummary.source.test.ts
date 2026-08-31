import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentEditSummary.ts", import.meta.url),
  "utf8",
);

describe("useAgentEditSummary contract", () => {
  it("tracks post-turn git changes and counts untracked text files", () => {
    expect(source).toContain("useAgentEditSummary");
    expect(source).toContain("gitPanelSnapshot");
    expect(source).toContain("filesChangedByAgent");
    expect(source).toContain("countDiffLines");
    expect(source).toContain("countTextLines");
    expect(source).toContain("beginEditTracking");
  });
});
