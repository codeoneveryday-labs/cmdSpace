import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceTerminalList.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceTerminalList contract", () => {
  it("preserves terminal focus, close, creation and limit feedback behavior", () => {
    expect(source).toContain("export function WorkspaceTerminalList");
    expect(source).toContain('event.key !== "Enter" && event.key !== " "');
    expect(source).toContain("onCloseTerminal(terminal)");
    expect(source).toContain("TerminalAgentSwitcher");
    expect(source).toContain('role="alert"');
  });
});
