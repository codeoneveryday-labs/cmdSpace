import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppHandleRegistry.ts", import.meta.url),
  "utf8",
);

describe("useAppHandleRegistry contract", () => {
  it("registers and removes terminal and editor handles", () => {
    expect(source).toContain("useAppHandleRegistry");
    expect(source).toContain("registerTerminalHandle");
    expect(source).toContain("registerEditorHandle");
    expect(source).not.toContain("registerPreviewHandle");
    expect(source).toContain("terminalRefs.current.delete");
    expect(source).toContain("editorRefs.current.delete");
    expect(source).not.toContain("previewRefs.current.delete");
    expect(source).toContain("setActiveEditorHandle(handle)");
  });
});
