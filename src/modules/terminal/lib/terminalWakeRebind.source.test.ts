import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalWakeRebind.ts", import.meta.url),
  "utf8",
);

describe("terminalWakeRebind contract", () => {
  it("installs guarded visibility/focus rebind listeners exactly once", () => {
    expect(source).toContain("installTerminalWakeRebind");
    expect(source).toContain('typeof document === "undefined"');
    expect(source).toContain('typeof window === "undefined"');
    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain("window.addEventListener(\"focus\"");
    expect(source).toContain("installed");
  });
});
