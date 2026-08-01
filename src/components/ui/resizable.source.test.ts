import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const resizablePath = path.join(here, "resizable.tsx");

describe("ResizableHandle hit area", () => {
  it("keeps terminal split handles aligned with their visible separator", () => {
    const source = readFileSync(resizablePath, "utf8");

    expect(source).toContain("react-resizable-panels");
    expect(source).toContain('data-slot="resizable-panel-group"');
    expect(source).toContain('data-slot="resizable-panel"');
    expect(source).toContain('data-slot="resizable-handle"');
    expect(source).toContain("relative flex w-px items-center justify-center");
    expect(source).toContain("after:left-1/2 after:w-1 after:-translate-x-1/2");
    expect(source).toContain("aria-[orientation=horizontal]:h-px");
    expect(source).toContain("aria-[orientation=horizontal]:after:h-1");
    expect(source).toContain("aria-[orientation=horizontal]:after:w-full");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("clientX:");
    expect(source).not.toContain("clientY:");
    expect(source).not.toContain("RESIZE_GHOST_HIT_ZONE_PX");
    expect(source).not.toContain("data-resize-hit-target");
    expect(source).not.toContain("w-8");
    expect(source).not.toContain("h-8");
  });
});
