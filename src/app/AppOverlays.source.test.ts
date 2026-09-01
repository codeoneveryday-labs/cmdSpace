import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AppOverlays.tsx", import.meta.url),
  "utf8",
);

describe("AppOverlays contract", () => {
  it("composes status, voice and confirmation surfaces without owning app state", () => {
    expect(source).toContain("AppOverlays");
    expect(source).toContain("ImportSessionDialog");
    expect(source).toContain("FloatingVoiceAgent");
    expect(source).toContain("UnsavedChangesDialogs");
    expect(source).toContain("WorkspaceDeleteDialog");
    expect(source).toContain("UpdaterDialog");
  });
});
