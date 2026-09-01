import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useRemoteTunnelSettings.ts", import.meta.url),
  "utf8",
);

describe("useRemoteTunnelSettings contract", () => {
  it("owns remote status, polling, toggle/reset, QR and copy lifecycle", () => {
    expect(source).toContain("remoteAccessStatus");
    expect(source).toContain("remoteAccessStart");
    expect(source).toContain("remoteAccessStop");
    expect(source).toContain("remoteAccessResetPassword");
    expect(source).toContain("setInterval(refresh, 1000)");
    expect(source).toContain("remoteSetupUrl");
    expect(source).toContain("copiedLink");
  });
});
