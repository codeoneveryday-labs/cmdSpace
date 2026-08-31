import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupFolder.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupFolder contract", () => {
  it("owns folder hydration, browsing and cd command application", () => {
    expect(source).toContain("useWorkspaceSetupFolder");
    expect(source).toContain('invoke<string | null>("select_folder")');
    expect(source).toContain("resolveFolderCommand");
    expect(source).toContain("setSelectedFolder");
  });
});
