import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentModelPicker.tsx", import.meta.url),
  "utf8",
);

describe("AgentModelPicker contract", () => {
  it("supports model search, selection, loading and refresh", () => {
    expect(source).toContain("export function AgentModelPicker");
    expect(source).toContain("Search models...");
    expect(source).toContain("Loading models from");
    expect(source).toContain("Refresh models");
    expect(source).toContain("onSelect(model.id)");
  });
});
