import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "useTrayWorkspaceData.ts",
);

describe("useTrayWorkspaceData", () => {
  it("owns workspace hydration and terminal fallback loading", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('invoke<TrayWorkspace[]>("db_list_workspaces")');
    expect(source).toContain('invoke<TrayPane[]>("db_list_panes"');
    expect(source).toContain("JSON.parse(workspace.paneLayout)");
    expect(source).toContain("setLoading(false)");
    expect(source).toContain("setError");
  });
});
