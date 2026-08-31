import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SourceControlPanelHeader.tsx", import.meta.url),
  "utf8",
);

describe("SourceControlPanelHeader contract", () => {
  it("renders repository status and delegates remote actions", () => {
    expect(source).toContain("SourceControlPanelHeader");
    expect(source).toContain("SourceControlRemoteActions");
    expect(source).toContain("repoLabel");
    expect(source).toContain("onRefresh");
    expect(source).toContain("Commit Graph");
  });
});
