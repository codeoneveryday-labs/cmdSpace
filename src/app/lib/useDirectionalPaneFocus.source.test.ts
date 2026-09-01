import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useDirectionalPaneFocus.ts", import.meta.url),
  "utf8",
);

describe("useDirectionalPaneFocus contract", () => {
  it("filters pane candidates by the active terminal tree before focusing", () => {
    expect(source).toContain("useDirectionalPaneFocus");
    expect(source).toContain("data-pane-leaf");
    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("hasLeaf(activeTab.paneTree, id)");
    expect(source).toContain("selectDirectionalPane");
    expect(source).toContain("focusPane(activeTab.id, targetId)");
  });
});
