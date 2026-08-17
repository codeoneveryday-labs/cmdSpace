import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "BottomTerminalDrawer.tsx"), "utf8");

describe("BottomTerminalDrawer", () => {
  it("uses the shared terminal lifecycle for every bottom tab", () => {
    expect(source).toContain("import { TerminalPane");
    expect(source).toContain("type TerminalPaneHandle");
    expect(source).toContain("terminalRefs.current");
    expect(source).toContain("disposeSession");
    expect(source).toContain("tabIdsRef.current.forEach(disposeSession)");
    expect(source).not.toContain("openPty(");
    expect(source).not.toContain("attachMacImeBridge");
  });

  it("focuses on demand and exposes a smooth vertical resize handle", () => {
    expect(source).toContain("focus: () => terminalRefs.current.get(activeTabId)?.focus()");
    expect(source).toContain('aria-label="Resize bottom terminal"');
    expect(source).toContain("cursor-row-resize");
    expect(source).toContain("requestAnimationFrame(flushResize)");
    expect(source).not.toContain(
      "relative flex flex-col overflow-hidden rounded-xl",
    );
    expect(source).not.toContain("shadow-[0_-16px_36px_-18px_rgba(0,0,0,0.45)]");
    expect(source).toContain("dark:bg-zinc-950/95");
  });

  it("shares the standard folder and branch controls with the active tab", () => {
    expect(source).toContain("TerminalNavigationControls");
    expect(source).toContain("onChangeDirectory={changeDirectory}");
    expect(source).toContain("const updateTabCwd");
    expect(source).toContain("onChangeDirectory={changeDirectory}");
  });

  it("keeps Music CLI out of the Cmd+I terminal drawer", () => {
    expect(source).not.toContain("MUSIC_CLI_LAUNCH_COMMAND");
    expect(source).not.toContain("MusicNote01Icon");
    expect(source).not.toContain("Music CLI");
    expect(source).toContain('label="Open terminal"');
  });

  it("keeps independent draggable terminal tabs inside the Cmd+I drawer", () => {
    expect(source).toContain("type BottomTerminalTab");
    expect(source).toContain("const createTerminalTab");
    expect(source).toContain("const addTerminalTab");
    expect(source).toContain("const reorderTabs");
    expect(source).toContain("setDraggingTabId");
    expect(source).toContain("cursor-grabbing");
    expect(source).toContain('data-bottom-terminal-tab={tab.id}');
    expect(source).toContain("onPointerMove");
    expect(source).toContain("onSelect={() => addTerminalTab()}");
    expect(source).toContain("<TerminalPane");
    expect(source).toContain("contentTopPadding={false}");
    expect(source).toContain('className="absolute inset-0"');
  });

  it("shows the active workspace coding-agent count in the drawer header", () => {
    expect(source).toContain("codingAgentCount: number");
    expect(source).toContain("Coding agents");
    expect(source).toContain("codingAgentCount");
  });
});
