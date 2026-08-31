import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupIdentitySync.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupIdentitySync contract", () => {
  it("keeps suggested workspace identity synchronized with setup inputs", () => {
    expect(source).toContain("useWorkspaceSetupIdentitySync");
    expect(source).toContain("suggestedWorkspaceName");
    expect(source).toContain("suggestedWorkspaceColor");
    expect(source).toContain("normalizeWorkspaceAccentColor");
  });
});
