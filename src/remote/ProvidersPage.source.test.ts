import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "ProvidersPage.tsx");

describe("ProvidersPage", () => {
  it("loads configured providers from the desktop over the authenticated HTTP API", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('"/api/remote/providers"');
    expect(source).toContain("Authorization: `Bearer ${authToken}`");
    expect(source).toContain("provider.configured");
    expect(source).not.toContain("new WebSocket");
  });

  it("renders configured providers and an add-provider catalog with search", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("Add provider");
    expect(source).toContain("Search providers");
    expect(source).toContain("Install instructions");
    expect(source).toContain("remote-provider-toggle");
  });
});
