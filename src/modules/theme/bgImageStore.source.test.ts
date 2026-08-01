import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const storePath = path.join(here, "bgImageStore.ts");

describe("background media storage", () => {
  it("allows videos up to 65 MB", () => {
    const source = readFileSync(storePath, "utf8");

    expect(source).toContain("const MAX_BACKGROUND_VIDEO_BYTES = 65 * 1024 * 1024;");
    expect(source).toContain("Background videos are limited to 65 MB.");
  });
});
