import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "useTrayProviderUsage.ts",
);

describe("useTrayProviderUsage", () => {
  it("owns provider usage loading, stale-request guards, and derived states", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("usageRequestId");
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("provider_limit_status");
    expect(source).toContain("visibleUsage");
    expect(source).toContain("hasPendingUsage");
  });
});
