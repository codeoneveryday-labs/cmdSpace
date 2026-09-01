import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./TabBarTabContent.tsx", import.meta.url),
  "utf8",
);

describe("TabBarTabContent contract", () => {
  it("owns tab icon, label, agent state and unsaved indicator presentation", () => {
    expect(source).toContain("export function TabBarTabContent");
    expect(source).toContain("AgentStateDot");
    expect(source).toContain("AgentCliIcon");
    expect(source).toContain("Unsaved changes");
    expect(source).toContain("cmdspace-music-tab-icon");
  });
});
