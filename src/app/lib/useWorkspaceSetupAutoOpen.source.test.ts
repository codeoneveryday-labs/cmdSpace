import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupAutoOpen.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupAutoOpen contract", () => {
  it("opens setup only after hydration when no workspace exists", () => {
    expect(source).toContain("useWorkspaceSetupAutoOpen");
    expect(source).toContain("hydrated && workspaceCount === 0");
    expect(source).toContain("setSetupOpen(true)");
    expect(source).toContain("useEffect");
  });
});
