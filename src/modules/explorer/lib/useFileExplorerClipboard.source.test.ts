import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useFileExplorerClipboard.ts", import.meta.url),
  "utf8",
);

describe("useFileExplorerClipboard contract", () => {
  it("owns internal, browser, and native Finder clipboard paths", () => {
    expect(source).toContain("INTERNAL_PATHS_MIME");
    expect(source).toContain("readInternalPaths");
    expect(source).toContain("importBrowserFiles");
    expect(source).toContain('fs_clipboard_paths');
    expect(source).toContain("event.preventDefault()");
  });
});
