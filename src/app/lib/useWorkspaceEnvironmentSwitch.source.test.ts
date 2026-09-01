import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceEnvironmentSwitch.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceEnvironmentSwitch contract", () => {
  it("guards dirty editors and resets runtime state after environment resolution", () => {
    expect(source).toContain("useWorkspaceEnvironmentSwitch");
    expect(source).toContain("unsaved editor tabs");
    expect(source).toContain("getWslHome");
    expect(source).toContain("workspaceAuthorize");
    expect(source).toContain("disposeSession(id)");
    expect(source).toContain("resetWorkspace");
    expect(source).toContain("tabId: null");
    expect(source).toContain("canvasTabId: null");
  });
});
