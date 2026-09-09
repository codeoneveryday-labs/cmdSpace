import { describe, expect, it } from "vitest";
import {
  SKILL_CATALOG,
  filterSkillCatalog,
  getFeaturedSkills,
  getSkillById,
} from "./skillCatalog";

describe("skillCatalog", () => {
  it("contains the curated GitHub repositories with complete display metadata", () => {
    expect(SKILL_CATALOG).toHaveLength(17);
    for (const skill of SKILL_CATALOG) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.repositoryUrl).toMatch(/^https:\/\/github\.com\//);
      expect(skill.category).toBeTruthy();
      expect(skill.kind).toBe("skill");
      expect(skill.icon).toBeTruthy();
    }
  });

  it("keeps featured entries independent from the selected catalog tab", () => {
    const featured = getFeaturedSkills();

    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((skill) => skill.featured)).toBe(true);
    expect(featured.every((skill) => skill.kind === "skill")).toBe(true);
  });

  it.each(["All", "Development Tools", "Knowledge & Learning"] as const)(
    "filters GitHub repositories by %s category",
    (category) => {
      const visible = filterSkillCatalog("recommended", category);

      expect(visible.every((skill) => skill.kind === "skill")).toBe(true);
      if (category !== "All") {
        expect(visible.every((skill) => skill.category === category)).toBe(true);
      }
    },
  );

  it("keeps the plugins filter empty until real plugin metadata is added", () => {
    expect(filterSkillCatalog("plugins", "All")).toEqual([]);
  });

  it("resolves a selected skill for the detail panel", () => {
    const first = SKILL_CATALOG[0];

    expect(first).toBeDefined();
    expect(getSkillById(first!.id)).toEqual(first);
    expect(getSkillById("missing-skill")).toBeNull();
  });
});
