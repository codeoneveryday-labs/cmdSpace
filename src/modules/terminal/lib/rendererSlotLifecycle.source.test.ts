import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./rendererSlotLifecycle.ts", import.meta.url),
  "utf8",
);

describe("rendererSlotLifecycle contract", () => {
  it("keeps bind, rewire, detach, and unhide behavior behind one lifecycle port", () => {
    expect(source).toContain("createRendererSlotLifecycle");
    expect(source).toContain("function bindSlot");
    expect(source).toContain("function rewireSlot");
    expect(source).toContain("function detachSlotFromLeaf");
    expect(source).toContain("scheduleUnhide");
    expect(source).toContain("params.drainRing");
    expect(source).toContain("params.registerOsc(slot.term)");
    expect(source).toContain("runtime.resize.setupResizeObserver");
    expect(source).toContain("runtime.clearSlotAutoCopyTimer");
    expect(source).not.toContain("selectRendererSlot");
  });
});
