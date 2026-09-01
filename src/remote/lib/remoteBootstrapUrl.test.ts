import { describe, expect, it } from "vitest";

import {
  readRemoteBootstrapSecretFromUrl,
  scrubRemoteBootstrapUrl,
} from "./remoteBootstrapUrl";

describe("remote bootstrap URL", () => {
  it("prefers and decodes the Android-safe setup path over query or hash secrets", () => {
    const url = new URL(
      "https://remote.example/setup/grant%2Fone?bootstrap=query#bootstrap=hash",
    );

    expect(readRemoteBootstrapSecretFromUrl(url)).toBe("grant/one");
  });

  it("falls back from an invalid encoded path to query then hash bootstrap secrets", () => {
    expect(
      readRemoteBootstrapSecretFromUrl(
        new URL("https://remote.example/setup/%ZZ?bootstrap=query#bootstrap=hash"),
      ),
    ).toBe("query");
    expect(
      readRemoteBootstrapSecretFromUrl(
        new URL("https://remote.example/?other=value#bootstrap=hash"),
      ),
    ).toBe("hash");
  });

  it("scrubs the one-time bootstrap secret while preserving unrelated query parameters", () => {
    expect(
      scrubRemoteBootstrapUrl(
        new URL("https://remote.example/setup/grant?bootstrap=query&theme=dark#bootstrap=hash"),
      ),
    ).toBe("/?theme=dark");
  });
});
