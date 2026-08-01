import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sectionPath = path.join(here, "ThemesSection.tsx");

describe("ThemesSection", () => {
  it("keeps canvas background import errors next to the canvas picker", () => {
    const source = readFileSync(sectionPath, "utf8");

    expect(source).toContain("const [canvasBgError, setCanvasBgError]");
    expect(source).toContain("{canvasBgError ? (");
    expect(source).toContain("setCanvasBgError(");
  });

  it("accepts MP4 and WebM for app and canvas backgrounds", () => {
    const source = readFileSync(sectionPath, "utf8");

    expect(source).toMatch(
      /ref=\{bgInputRef\}[\s\S]{0,200}accept="image\/\*,video\/mp4,video\/webm"/,
    );
    expect(source).toMatch(
      /ref=\{canvasBgInputRef\}[\s\S]{0,200}accept="image\/\*,video\/mp4,video\/webm"/,
    );
    expect(source).toContain("importBackgroundMediaFromFile");
  });
});
