import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupImportSelection.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupImportSelection contract", () => {
  it("guards active, duplicate and over-capacity session imports", () => {
    expect(source).toContain("useWorkspaceSetupImportSelection");
    expect(source).toContain("session.active");
    expect(source).toContain("remainingAgentSlots");
    expect(source).toContain("existingKeys");
    expect(source).toContain("setSelectedImportSessions");
  });
});
