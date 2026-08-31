import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./sourceControlPanelModel.ts", import.meta.url),
  "utf8",
);

describe("sourceControlPanelModel contract", () => {
  it("centralizes source-control action availability and feedback derivation", () => {
    expect(source).toContain("deriveSourceControlPanelModel");
    expect(source).toContain("canCommit");
    expect(source).toContain("canPull");
    expect(source).toContain("canFetch");
    expect(source).toContain("footerFeedback");
  });
});
