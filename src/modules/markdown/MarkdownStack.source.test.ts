import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/markdown/MarkdownStack.tsx"),
  "utf8",
);

describe("markdown editor preview toggle", () => {
  it("provides editor and preview modes in the markdown tab toolbar", () => {
    expect(source).toContain('"editor" | "preview"');
    expect(source).toContain('aria-label="Edit Markdown"');
    expect(source).toContain('aria-label="Preview Markdown"');
    expect(source).toContain('aria-pressed={mode === "editor"}');
    expect(source).toContain('aria-pressed={mode === "preview"}');
    expect(source).toContain("<EditorPane ref={getEditorRef(t.id)} path={t.path} />");
    expect(source).toContain("await editorRefs.current.get(t.id)?.save()");
    expect(source).toContain("<MarkdownPreviewPane");
  });
});
