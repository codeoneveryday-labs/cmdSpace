import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceTerminalCreationAction.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceTerminalCreationAction contract", () => {
  it("assembles standard, canvas and agent terminal creation ports", () => {
    expect(source).toContain("useWorkspaceTerminalCreationAction");
    expect(source).toContain("createWorkspaceTerminal({");
    expect(source).toContain("canvasTerminalCreators");
    expect(source).toContain("appendTerminalPane");
    expect(source).toContain("newAgentChatTab");
    expect(source).toContain("persistPaneRecord");
    expect(source).toContain("scheduleWorkspacePaneSessionSync");
    expect(source).toContain("window.alert(message)");
  });
});
