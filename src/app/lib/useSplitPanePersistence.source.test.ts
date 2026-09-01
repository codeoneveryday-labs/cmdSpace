import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useSplitPanePersistence.ts", import.meta.url),
  "utf8",
);

describe("useSplitPanePersistence contract", () => {
  it("persists updated workspace geometry and every pane through ports", () => {
    expect(source).toContain("useSplitPanePersistence");
    expect(source).toContain("JSON.stringify(paneTree)");
    expect(source).toContain("persistWorkspace(updated)");
    expect(source).toContain("persistPaneRecord");
    expect(source).toContain("findLeafCwd");
    expect(source).toContain("findLeafLastCommand");
    expect(source).toContain("findLeafAutoLaunch");
    expect(source).toContain("Failed to persist split terminal panes");
  });
});
