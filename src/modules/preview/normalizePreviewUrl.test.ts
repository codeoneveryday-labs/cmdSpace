import { describe, expect, it } from "vitest";

import { normalizePreviewUrl } from "./normalizePreviewUrl";

describe("normalizePreviewUrl", () => {
  it("preserves explicit HTTP URLs and trims surrounding whitespace", () => {
    expect(normalizePreviewUrl("  https://example.com/docs  ")).toBe(
      "https://example.com/docs",
    );
  });

  it("uses HTTP for local preview targets", () => {
    expect(normalizePreviewUrl("localhost:5173")).toBe(
      "http://localhost:5173",
    );
    expect(normalizePreviewUrl("127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("uses HTTPS for bare public domains and keeps non-URL input unchanged", () => {
    expect(normalizePreviewUrl("example.com")).toBe("https://example.com");
    expect(normalizePreviewUrl("not a url")).toBe("not a url");
    expect(normalizePreviewUrl("  ")).toBe("");
  });
});
