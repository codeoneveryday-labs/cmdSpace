import { describe, expect, it } from "vitest";
import {
  decodeRemoteServerEnvelope,
  REMOTE_PROTOCOL_VERSION,
} from "./protocol";

describe("remote protocol v2", () => {
  it("carries terminal UTF-8 directly without hex decoding", () => {
    expect(REMOTE_PROTOCOL_VERSION).toBe(2);
    expect(
      decodeRemoteServerEnvelope(
        JSON.stringify({
          version: 2,
          message: {
            type: "output",
            sessionId: 1,
            sequence: 2,
            data: "héllo",
          },
        }),
      ).message,
    ).toMatchObject({ data: "héllo" });
  });

  it("rejects legacy clients explicitly", () => {
    expect(() =>
      decodeRemoteServerEnvelope(
        JSON.stringify({ version: 1, message: { type: "pong" } }),
      ),
    ).toThrow("unsupported remote protocol version: 1");
  });
});

describe("remote protocol v3 device pairing", () => {
  it("does not make a v3 device envelope appear valid to the v2 browser decoder", () => {
    expect(() =>
      decodeRemoteServerEnvelope(
        JSON.stringify({
          version: 3,
          message: {
            type: "deviceAuthenticated",
            deviceId: "device-1",
          },
        }),
      ),
    ).toThrow("unsupported remote protocol version: 3");
  });
});
