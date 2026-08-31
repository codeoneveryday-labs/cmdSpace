import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./rendererSlotModel.ts", import.meta.url), "utf8");

describe("rendererSlotModel contract", () => {
  it("keeps eviction scoring independent from DOM and PTY effects", () => {
    expect(source).toContain("selectRendererSlot");
    expect(source).toContain("slot.altScreen ? 100 : 0");
    expect(source).toContain("slot.focused ? 10 : 0");
    expect(source).not.toContain("document.");
    expect(source).not.toContain("evictLeaf");
  });
});
