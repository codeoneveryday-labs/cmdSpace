import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceHydration.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceHydration contract", () => {
  it("owns workspace, recent-workspace and pane hydration through an invoke adapter", () => {
    expect(source).toContain("useWorkspaceHydration");
    expect(source).toContain('"db_list_workspaces"');
    expect(source).toContain('"db_list_recent_workspaces"');
    expect(source).toContain('"db_list_panes"');
    expect(source).toContain("setWorkspacesHydrated");
    expect(source).toContain("Object.fromEntries(entries)");
  });
});
