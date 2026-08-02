import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paneSource = readFileSync(
  resolve(process.cwd(), "src/modules/editor/EditorPane.tsx"),
  "utf8",
);
const documentSource = readFileSync(
  resolve(process.cwd(), "src/modules/editor/lib/useDocument.ts"),
  "utf8",
);

describe("editor image preview", () => {
  it("loads supported media paths through native readers", () => {
    expect(documentSource).toContain('invoke<ImageResult>("fs_read_image"');
    expect(documentSource).toContain('status: "image"');
    expect(documentSource).toContain('invoke<ImageResult>("fs_read_video"');
    expect(documentSource).toContain('status: "video"');
  });

  it("renders image documents outside CodeMirror", () => {
    expect(paneSource).toContain('doc.status === "image"');
    expect(paneSource).toContain("src={doc.dataUrl}");
    expect(paneSource).toContain('doc.status === "video"');
    expect(paneSource).toContain("<video");
  });
});
