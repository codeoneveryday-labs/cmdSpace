import { describe, expect, it } from "vitest";
import { wouldCheckoutReloadDevApp } from "./devReloadGuard";

describe("wouldCheckoutReloadDevApp", () => {
  it("blocks checkout only when dev mode is running from the same repo root", () => {
    expect(
      wouldCheckoutReloadDevApp(
        "/Users/me/dev/app/terax-ai",
        "/Users/me/dev/app/terax-ai",
        true,
      ),
    ).toBe(true);
    expect(
      wouldCheckoutReloadDevApp(
        "/Users/me/dev/app/terax-ai",
        "/Users/me/dev/app/terax-ai/",
        true,
      ),
    ).toBe(true);
    expect(
      wouldCheckoutReloadDevApp(
        "/Users/me/dev/app/other-project",
        "/Users/me/dev/app/terax-ai",
        true,
      ),
    ).toBe(false);
    expect(
      wouldCheckoutReloadDevApp(
        "/Users/me/dev/app/terax-ai",
        "/Users/me/dev/app/terax-ai",
        false,
      ),
    ).toBe(false);
  });
});
