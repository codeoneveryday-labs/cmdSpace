import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const explorerSource = readFileSync(
  resolve(process.cwd(), "src/modules/explorer/FileExplorer.tsx"),
  "utf8",
);
const rowSource = readFileSync(
  resolve(process.cwd(), "src/modules/explorer/TreeRow.tsx"),
  "utf8",
);

describe("Explorer file transfer integration", () => {
  it("imports native dropped paths and browser clipboard files", () => {
    expect(explorerSource).toContain("onDragDropEvent");
    expect(explorerSource).toContain("tree.importPaths(payload.paths, destination)");
    expect(explorerSource).toContain("tree.importClipboardFile(");
    expect(explorerSource).toContain("onPaste={handlePaste}");
  });

  it("moves internal Explorer drags with an isolated data-transfer type", () => {
    expect(rowSource).toContain('application/x-cmdspace-paths');
    expect(rowSource).toContain("onMovePaths(paths, path, isDir)");
    expect(explorerSource).toContain("tree.movePaths(sources, destination)");
  });
});
