import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionVisibilityModel.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionVisibilityModel contract", () => {
  it("centralizes visibility/focus transitions and slot reacquisition", () => {
    expect(source).toContain("syncTerminalSessionVisibility");
    expect(source).toContain("visibleNow");
    expect(source).toContain("focusedNow");
    expect(source).toContain("bindLeafToSlot");
    expect(source).toContain("setSlotFocused");
    expect(source).toContain("focusSlot");
  });
});
