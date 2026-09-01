import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./workspaceItemsModel.ts", import.meta.url),
  "utf8",
);

describe("workspaceItemsModel contract", () => {
  it("owns workspace terminal view-model branching without IPC", () => {
    expect(source).toContain("export function buildWorkspaceItems");
    expect(source).toContain("terminalsForCanvas");
    expect(source).toContain("terminalsForAgentTabs");
    expect(source).toContain("terminalsForPersistedPanes");
    expect(source).not.toContain("invoke(");
  });
});
