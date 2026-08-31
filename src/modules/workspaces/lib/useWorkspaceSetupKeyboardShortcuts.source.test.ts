import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupKeyboardShortcuts.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupKeyboardShortcuts contract", () => {
  it("owns Escape/Enter handling and ignores editable targets", () => {
    expect(source).toContain("useWorkspaceSetupKeyboardShortcuts");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain("isEditableKeyboardTarget");
    expect(source).toContain('window.addEventListener("keydown"');
    expect(source).toContain("removeEventListener");
  });
});
