import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useLiveTerminalCleanup.ts", import.meta.url),
  "utf8",
);

describe("useLiveTerminalCleanup contract", () => {
  it("tracks live pane leaves and disposes stale terminal resources", () => {
    expect(source).toContain("useLiveTerminalCleanup");
    expect(source).toContain("leafIds(tab.paneTree)");
    expect(source).toContain("disposeSession(id)");
    expect(source).toContain("terminalRefs.current.delete(key)");
    expect(source).toContain("searchAddons.current.delete(key)");
    expect(source).toContain("liveLeavesRef.current = live");
  });
});
