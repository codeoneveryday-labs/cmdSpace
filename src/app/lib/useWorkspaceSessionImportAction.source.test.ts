import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSessionImportAction.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSessionImportAction contract", () => {
  it("assembles the workspace import ports without owning import implementation", () => {
    expect(source).toContain("useWorkspaceSessionImportAction");
    expect(source).toContain("importAgentSession({");
    expect(source).toContain("workspaceId");
    expect(source).toContain("appendTerminalPane");
    expect(source).toContain("updateCanvasDiagram");
    expect(source).toContain("persistPaneRecord");
    expect(source).toContain("scheduleWorkspacePaneSessionSync");
    expect(source).toContain("window.alert(message)");
  });
});
