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
const tauriSource = readFileSync(
  resolve(process.cwd(), "src-tauri/src/lib.rs"),
  "utf8",
);
const appSource = readFileSync(
  resolve(process.cwd(), "src/app/App.tsx"),
  "utf8",
);
const internalDragSource = readFileSync(
  resolve(process.cwd(), "src/modules/explorer/lib/internalDrag.ts"),
  "utf8",
);

describe("Explorer file transfer integration", () => {
  it("imports native dropped paths and browser clipboard files", () => {
    expect(explorerSource).toContain("onDragDropEvent");
    expect(explorerSource).toContain("acceptExternalDrops");
    expect(explorerSource).toContain("tree.importPaths(payload.paths, destination)");
    expect(explorerSource).toContain("tree.importClipboardFile(");
    expect(explorerSource).toContain("onPaste={handlePaste}");
  });

  it("moves internal Explorer drags with pointer events instead of HTML drag data", () => {
    expect(internalDragSource).toContain("hasExceededDragThreshold");
    expect(rowSource).toContain("setPointerCapture(event.pointerId)");
    expect(rowSource).toContain("onPointerMove={handlePointerMove}");
    expect(rowSource).toContain("onPointerUp={handlePointerUp}");
    expect(rowSource).not.toContain("draggable");
    expect(rowSource).toContain("onInternalDragEnd(dragPaths");
    expect(explorerSource).toContain("tree.movePaths(sources, destination)");
  });

  it("copies and pastes the selected Explorer paths with platform shortcuts", () => {
    expect(explorerSource).toContain("onCopy={handleCopy}");
    expect(explorerSource).toContain("event.clipboardData.setData(");
    expect(explorerSource).toContain("readInternalPaths(event.clipboardData)");
    expect(explorerSource).toContain("tree.importPaths(internalPaths, dropDestination())");
  });

  it("falls back to native Finder paths when WebKit exposes no pasted files", () => {
    expect(explorerSource).toContain('invoke<string[]>("fs_clipboard_paths")');
    expect(tauriSource).toContain("fs::mutate::fs_clipboard_paths");
  });

  it("accepts native drops over Explorer independently of the active editor tab", () => {
    expect(explorerSource).not.toContain("if (!acceptExternalDrops) return");
    expect(explorerSource).toContain('getCurrentWebview } from "@tauri-apps/api/webview"');
    expect(explorerSource).toContain("appWebview.onDragDropEvent");
    expect(explorerSource).not.toContain("getCurrentWindow().onDragDropEvent");
    expect(explorerSource).toContain("overExplorer || overEditor");
    expect(explorerSource).toContain("[data-editor-file-drop-region]");
    expect(appSource).toContain("data-editor-file-drop-region");
  });

  it("moves internal drags dropped on empty Explorer space", () => {
    expect(explorerSource).toContain("resolveInternalDropTarget");
    expect(explorerSource).toContain("scrollRef.current?.getBoundingClientRect()");
  });
});
