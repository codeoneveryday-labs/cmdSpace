import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspacePanelHeader.tsx", import.meta.url),
  "utf8",
);

describe("WorkspacePanelHeader contract", () => {
  it("exposes workspace creation and session import actions", () => {
    expect(source).toContain("WorkspacePanelHeader");
    expect(source).toContain("onStartWorkspaceSetup");
    expect(source).toContain("onImportSession");
    expect(source).toContain('disabled={activeWorkspaceId === null}');
    expect(source).toContain("WORKSPACES");
  });
});
