import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const globalsPath = path.join(here, "globals.css");
const useZoomPath = path.join(here, "../lib/useZoom.ts");
const zoomConstantsPath = path.join(here, "../lib/zoomConstants.ts");
const appPath = path.join(here, "../app/App.tsx");

describe("app zoom hit testing", () => {
  it("uses transform scaling instead of CSS zoom so hover regions stay aligned", () => {
    const globals = readFileSync(globalsPath, "utf8");
    const useZoom = readFileSync(useZoomPath, "utf8");
    const zoomConstants = readFileSync(zoomConstantsPath, "utf8");
    const app = readFileSync(appPath, "utf8");

    expect(globals).toContain("--app-zoom-inverse");
    expect(globals).toContain("transform: scale(var(--app-zoom));");
    expect(globals).toContain("width: calc(100% * var(--app-zoom-inverse));");
    expect(globals).toContain("height: calc(100% * var(--app-zoom-inverse));");
    expect(globals).not.toContain("zoom: var(--app-zoom)");
    expect(zoomConstants).toContain(
      'APP_ZOOM_INVERSE_CSS_VAR = "--app-zoom-inverse";',
    );
    expect(useZoom).toContain("APP_ZOOM_INVERSE_CSS_VAR");
    expect(useZoom).toContain("String(1 / z)");
    expect(app).toContain(
      '<main className="relative min-h-0 flex-1 overflow-hidden">',
    );
    expect(app).toContain(
      '<div className="zoom-content absolute left-0 top-0 flex min-h-0">',
    );
  });
});
