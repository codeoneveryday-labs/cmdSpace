import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const surfacePath = path.join(here, "SurfaceLayer.tsx");

describe("SurfaceLayer", () => {
  it("renders stored videos as muted looping background media", () => {
    const source = readFileSync(surfacePath, "utf8");

    expect(source).toContain("<video");
    expect(source).toContain("useBackgroundVideoPlayback");
    expect(source).toContain('media.type.startsWith("video/")');
    expect(source).not.toContain("          autoPlay\n");
    expect(source).not.toContain("          src={url}\n");
  });
});
