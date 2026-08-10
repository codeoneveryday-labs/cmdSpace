import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const headerPath = path.join(here, "Header.tsx");

describe("Header sidebar toggles", () => {
  it("uses opposite sidebar icons for left workspaces and right sidebar toggles", () => {
    const source = readFileSync(headerPath, "utf8");

    expect(source).toContain("SidebarLeftIcon");
    expect(source).toContain("SidebarRightIcon");
    expect(source).toContain("<HugeiconsIcon icon={SidebarRightIcon}");
    expect(source).toContain("<HugeiconsIcon icon={SidebarLeftIcon}");
  });

  it("exposes a persistent background blur toggle", () => {
    const source = readFileSync(headerPath, "utf8");

    expect(source).toContain("FocusPointIcon");
    expect(source).toContain('aria-pressed={desktopBlurEnabled}');
    expect(source).not.toContain("disabled={!backgroundEnabled}");
    expect(source).toContain("set_desktop_blur");
    expect(source).toContain("setDesktopBlurEnabled(enabled)");
  });

  it("places a provider limits usage control beside keyboard shortcuts", () => {
    const source = readFileSync(headerPath, "utf8");

    expect(source).toContain("ProviderUsagePopover");
    expect(source).toContain("ProviderUsageErrorBoundary");
    expect(source.match(/<ProviderUsageErrorBoundary>/g)).toHaveLength(2);
    expect(source).toContain("Provider limits");
    expect(source).toContain("shortcutsButton");
  });
});
