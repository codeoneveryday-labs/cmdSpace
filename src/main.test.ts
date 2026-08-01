import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const mainPath = path.join(here, "main.tsx");

describe("desktop blur overlay bootstrap", () => {
  it("renders the overlay without a blocking frontend-ready handshake", () => {
    const source = readFileSync(mainPath, "utf8");
    const overlayBranch = source.indexOf("if (isDesktopBlurOverlay)");
    const appImport = source.indexOf('import("./app/App")');

    expect(overlayBranch).toBeGreaterThan(-1);
    expect(appImport).toBeGreaterThan(-1);
    expect(overlayBranch).toBeLessThan(appImport);
    expect(source).toContain('dataset.desktopBlurState = "on"');
    expect(source).not.toContain('invoke("desktop_blur_overlay_ready")');
  });
});
