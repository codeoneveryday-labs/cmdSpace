import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/editor/EditorStack.tsx"),
  "utf8",
);

describe("markdown editor preview toggle", () => {
  it("adds editor and preview modes to markdown files opened in EditorStack", () => {
    expect(source).toContain("/\\.(md|markdown)$/i.test(t.path)");
    expect(source).toContain('aria-label="Edit Markdown"');
    expect(source).toContain('aria-label="Preview Markdown"');
    expect(source).toContain('aria-pressed={mode === "editor"}');
    expect(source).toContain('aria-pressed={mode === "preview"}');
    expect(source).toContain("<MarkdownPreviewPane");
    expect(source).toContain("await editorHandles.current.get(t.id)?.save()");
  });
});
