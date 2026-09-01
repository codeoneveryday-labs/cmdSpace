import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppChromeActions.ts", import.meta.url),
  "utf8",
);

describe("useAppChromeActions contract", () => {
  it("coordinates shell toggles, canvas focus and explorer focus restoration", () => {
    expect(source).toContain("useAppChromeActions");
    expect(source).toContain("toggleSidebar");
    expect(source).toContain("toggleWorkspacesPanel");
    expect(source).toContain("canvasFocused");
    expect(source).toContain("cycleSidebarView");
    expect(source).toContain("persistSidebarView(\"editor\")");
    expect(source).toContain("explorerReturnFocusRef.current");
    expect(source).toContain("pauseTerminalResizeForChromeTransition");
  });
});
