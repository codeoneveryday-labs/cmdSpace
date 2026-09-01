import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppSearchRegistry.ts", import.meta.url),
  "utf8",
);

describe("useAppSearchRegistry contract", () => {
  it("tracks active leaf search addons and registers ready addons", () => {
    expect(source).toContain("useAppSearchRegistry");
    expect(source).toContain("searchAddons.current.get(activeLeafId)");
    expect(source).toContain("searchAddons.current.set(leafId, addon)");
    expect(source).toContain("setActiveSearchAddon(addon)");
    expect(source).toContain("activeLeafId");
  });
});
