import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SkillsCatalogView.tsx", import.meta.url),
  "utf8",
);

describe("SkillsCatalogView contract", () => {
  it("renders a browsable GitHub skills catalog with details", () => {
    expect(source).toContain("export function SkillsCatalogView");
    expect(source).toContain("Skill & Plugin");
    expect(source).toContain("Featured");
    expect(source).toContain(">Skills</h2>");
    expect(source).toContain("SKILL_CATALOG");
    expect(source).toContain("repositoryUrl");
    expect(source).toContain("View on GitHub");
    expect(source).toContain("role=\"button\"");
    expect(source).toContain("selectedSkillId");
    expect(source).not.toContain("Add01Icon");
    expect(source).not.toContain("Install");
    expect(source).not.toContain("Install flow coming soon");
    expect(source).not.toContain("Recommended");
    expect(source).not.toContain("Plugins");
    expect(source).not.toContain("SKILL_CATEGORIES");
    expect(source).not.toContain("filterSkillCatalog");
    expect(source).not.toContain("ArrowLeft02Icon");
    expect(source).not.toContain("Workspaces");
  });
});
