import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "AppSidebar.tsx",
);

describe("AppSidebar", () => {
  it("composes explorer and source-control surfaces without owning state", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("FileExplorer");
    expect(source).toContain("SourceControlPanel");
    expect(source).toContain("EditorSidebarRail");
    expect(source).not.toContain("useState(");
    expect(source).not.toContain("invoke(");
  });
});
