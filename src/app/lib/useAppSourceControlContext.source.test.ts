import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppSourceControlContext.ts", import.meta.url),
  "utf8",
);

describe("useAppSourceControlContext contract", () => {
  it("centralizes git context path and activation policy", () => {
    expect(source).toContain("useAppSourceControlContext");
    expect(source).toContain("resolveSourceControlContextPath");
    expect(source).toContain("hasOpenGitTab");
    expect(source).toContain('sidebarView === "editor"');
    expect(source).toContain("sourceControlPath");
    expect(source).toContain("badgeContextPath");
  });
});
