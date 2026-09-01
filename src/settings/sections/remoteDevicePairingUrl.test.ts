import { describe, expect, it } from "vitest";

import { buildNativeDevicePairingUrl } from "./remoteDevicePairingUrl";

describe("buildNativeDevicePairingUrl", () => {
  it("encodes every pairing grant field in the native deep link", () => {
    const url = new URL(
      buildNativeDevicePairingUrl({
        url: "https://remote.example/setup?a=1&b=2",
        relay: "wss://relay.example/room one",
        relayId: "room/one",
        secret: "grant+with/special?chars",
        expiresAt: 1,
      }),
    );

    expect(url.protocol).toBe("cmdspace:");
    expect(url.hostname).toBe("device-pair");
    expect(url.searchParams.get("url")).toBe("https://remote.example/setup?a=1&b=2");
    expect(url.searchParams.get("relay")).toBe("wss://relay.example/room one");
    expect(url.searchParams.get("relayId")).toBe("room/one");
    expect(url.searchParams.get("grant")).toBe("grant+with/special?chars");
  });

  it("returns no link before a pairing grant exists", () => {
    expect(buildNativeDevicePairingUrl(null)).toBe("");
  });
});
