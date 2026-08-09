import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CanvasEditorNode, canvasEditorTitle } from "./CanvasEditorNode";

vi.mock("@/modules/editor", () => ({
  EditorPane: ({ path }: { path: string }) => <div data-editor-path={path} />,
}));

describe("CanvasEditorNode", () => {
  it("renders an explicit file-path empty state", () => {
    const markup = renderToStaticMarkup(
      <CanvasEditorNode
        active
        locked={false}
        onPathChange={() => undefined}
        onActivate={() => undefined}
        onHeaderPointerDown={() => undefined}
        onToggleLock={() => undefined}
        onRequestClose={() => undefined}
      />,
    );

    expect(markup).toContain('placeholder="Enter a file path"');
    expect(markup).toContain("Open file");
    expect(markup).toContain('aria-label="Close editor node"');
  });

  it("renders EditorPane for a selected path and derives a concise title", () => {
    const markup = renderToStaticMarkup(
      <CanvasEditorNode
        path="/tmp/project/example.ts"
        active
        locked={false}
        onPathChange={() => undefined}
        onActivate={() => undefined}
        onHeaderPointerDown={() => undefined}
        onToggleLock={() => undefined}
        onRequestClose={() => undefined}
      />,
    );

    expect(markup).toContain('data-editor-path="/tmp/project/example.ts"');
    expect(canvasEditorTitle("/tmp/project/example.ts")).toBe("example.ts");
  });
});
