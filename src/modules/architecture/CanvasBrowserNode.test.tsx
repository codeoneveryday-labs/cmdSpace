import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CanvasBrowserNode } from "./CanvasBrowserNode";

vi.mock("@/modules/preview", () => ({
  SidebarBrowserPane: ({
    url,
    visible,
    resizing,
    boundsRevision,
  }: {
    url: string;
    visible: boolean;
    resizing: boolean;
    boundsRevision: string | number;
  }) => (
    <div
      data-browser-url={url}
      data-browser-visible={String(visible)}
      data-browser-resizing={String(resizing)}
      data-browser-bounds={String(boundsRevision)}
    />
  ),
}));

describe("CanvasBrowserNode", () => {
  it("renders existing browser behavior inside accessible canvas chrome", () => {
    const markup = renderToStaticMarkup(
      <CanvasBrowserNode
        url="https://example.com"
        active
        interactionBlocked
        boundsRevision="camera-2"
        stackTabs={[
          { id: "browser-1", label: "Browser", kind: "browser" },
          { id: "terminal-1", label: "Terminal", kind: "terminal" },
        ]}
        activeTabId="browser-1"
        singleSurfaceGroup
        surfaceGroupLocked={false}
        maximized={false}
        onUrlChange={() => undefined}
        onActivate={() => undefined}
        onActivateTab={() => undefined}
        onTabPointerDown={() => undefined}
        onRequestCloseTab={() => undefined}
        onAddTab={() => undefined}
        onSplitRight={() => undefined}
        onHeaderPointerDown={() => undefined}
        onToggleSurfaceGroupLock={() => undefined}
        onToggleSurfaceGroupMaximize={() => undefined}
        onRequestCloseSurfaceGroup={() => undefined}
      />,
    );

    expect(markup).toContain('data-browser-url="https://example.com"');
    expect(markup).toContain('data-browser-visible="true"');
    expect(markup).toContain('data-browser-resizing="true"');
    expect(markup).toContain('data-browser-bounds="camera-2"');
    expect(markup).toContain('aria-label="Canvas browser tabs"');
    expect(markup).toContain('aria-label="Add browser tab"');
    expect(markup).toContain('aria-label="Split browser right"');
    expect(markup).toContain('aria-label="Lock browser group"');
    expect(markup).toContain('aria-label="Maximize browser group"');
    expect(markup).toContain('aria-label="Close browser group"');
    expect(markup).toContain('data-canvas-surface-tab-kind="browser"');
    expect(markup).toContain('data-canvas-surface-tab-kind="terminal"');
  });

  it("keeps the browser header for a single browser tab", () => {
    const markup = renderToStaticMarkup(
      <CanvasBrowserNode
        url="https://example.com"
        active
        interactionBlocked={false}
        boundsRevision="camera-3"
        stackTabs={[{ id: "browser-1", label: "Browser", kind: "browser" }]}
        activeTabId="browser-1"
        singleSurfaceGroup
        surfaceGroupLocked={false}
        maximized={false}
        onUrlChange={() => undefined}
        onActivate={() => undefined}
        onActivateTab={() => undefined}
        onTabPointerDown={() => undefined}
        onRequestCloseTab={() => undefined}
        onAddTab={() => undefined}
        onSplitRight={() => undefined}
        onHeaderPointerDown={() => undefined}
        onToggleSurfaceGroupLock={() => undefined}
        onToggleSurfaceGroupMaximize={() => undefined}
        onRequestCloseSurfaceGroup={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Canvas browser tabs"');
    expect(markup).not.toContain('data-canvas-surface-single-toolbar="true"');
  });
});
