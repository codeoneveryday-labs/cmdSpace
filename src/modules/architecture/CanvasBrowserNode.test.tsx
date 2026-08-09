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
        locked={false}
        interactionBlocked
        boundsRevision="camera-2"
        onUrlChange={() => undefined}
        onActivate={() => undefined}
        onHeaderPointerDown={() => undefined}
        onToggleLock={() => undefined}
        onRequestClose={() => undefined}
      />,
    );

    expect(markup).toContain('data-browser-url="https://example.com"');
    expect(markup).toContain('data-browser-visible="true"');
    expect(markup).toContain('data-browser-resizing="true"');
    expect(markup).toContain('data-browser-bounds="camera-2"');
    expect(markup).toContain('aria-label="Close browser node"');
    expect(markup).toContain('aria-label="Lock browser node"');
  });
});
