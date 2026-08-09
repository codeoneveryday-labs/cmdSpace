import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "ProviderUsagePopover.tsx");

describe("ProviderUsagePopover", () => {
  it("loads only provider rate limits from the native bridge", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('invoke<ProviderLimitStatus[]>("provider_limit_statuses")');
    expect(source).toContain("Local CLI telemetry");
    expect(source).toContain("No account limit reported locally");
    expect(source).not.toContain("contextTokens");
  });
});
