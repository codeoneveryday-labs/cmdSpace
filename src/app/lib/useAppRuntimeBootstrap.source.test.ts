import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppRuntimeBootstrap.ts", import.meta.url),
  "utf8",
);

describe("useAppRuntimeBootstrap contract", () => {
  it("owns app startup hydration and cleans up external listeners", () => {
    expect(source).toContain("useAppRuntimeBootstrap");
    expect(source).toContain("workspaceAuthorize");
    expect(source).toContain("workspaceCurrentDir");
    expect(source).toContain("getAllKeys");
    expect(source).toContain("onKeysChanged");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("initPrefs");
    expect(source).toContain("remoteAccessStatus");
    expect(source).toContain("remoteAccessStart");
    expect(source).toContain("alive = false");
  });
});
