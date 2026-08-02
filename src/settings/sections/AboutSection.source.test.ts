import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const aboutPath = path.join(here, "AboutSection.tsx");

describe("AboutSection source contract", () => {
  it("opens the release page directly for manual updater fallbacks", () => {
    const source = readFileSync(aboutPath, "utf8");

    expect(source).toContain("manualAvailable");
    expect(source).toContain("else if (manualAvailable) void openUrl(status.info.releaseUrl)");
    expect(source).toContain("Download v${status.info.version} manually");
  });
});
