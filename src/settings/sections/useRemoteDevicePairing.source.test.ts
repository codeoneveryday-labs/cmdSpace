import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useRemoteDevicePairing.ts", import.meta.url),
  "utf8",
);

describe("useRemoteDevicePairing contract", () => {
  it("owns pairing list/start/revoke lifecycle and hostname invalidation", () => {
    expect(source).toContain("remoteDeviceList");
    expect(source).toContain("remoteDevicePairingStart");
    expect(source).toContain("remoteDeviceRevoke");
    expect(source).toContain("setPairing(null)");
    expect(source).toContain("setBusy(false)");
  });
});
