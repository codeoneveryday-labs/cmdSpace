import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppSourceControlActions.ts", import.meta.url),
  "utf8",
);

describe("useAppSourceControlActions contract", () => {
  it("keeps source-control panel navigation and graph resolution behind ports", () => {
    expect(source).toContain("useAppSourceControlActions");
    expect(source).toContain("setEditorSidebarView");
    expect(source).toContain("cycleSidebarView");
    expect(source).toContain("sourceControl.hasRepo");
    expect(source).toContain("native.gitResolveRepo");
    expect(source).toContain("openCommitHistoryTab");
  });
});
