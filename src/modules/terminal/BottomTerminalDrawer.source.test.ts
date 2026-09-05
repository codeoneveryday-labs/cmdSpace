import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "BottomTerminalDrawer.tsx"), "utf8");
const appSource = readFileSync(path.join(here, "../../app/App.tsx"), "utf8");
const workspaceTerminalViewSource = readFileSync(
  path.join(here, "../../app/lib/useAppWorkspaceTerminalView.ts"),
  "utf8",
);
const resizeSource = readFileSync(
  path.join(here, "useBottomTerminalResize.ts"),
  "utf8",
);
const tabDragSource = readFileSync(
  path.join(here, "useBottomTerminalTabDrag.ts"),
  "utf8",
);
const drawerInteractionSource = `${source}\n${resizeSource}\n${tabDragSource}`;

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
    const resizeAwareSource = `${source}\n${resizeSource}`;
    expect(resizeAwareSource).toContain("focus: () => terminalRefs.current.get(activeTabId)?.focus()");
    expect(resizeAwareSource).toContain('aria-label="Resize bottom terminal"');
    expect(resizeAwareSource).toContain("cursor-row-resize");
    expect(resizeAwareSource).toContain("requestAnimationFrame(flushResize)");
    expect(resizeAwareSource).not.toContain(
      "relative flex flex-col overflow-hidden rounded-xl",
    );
    expect(resizeAwareSource).not.toContain("shadow-[0_-16px_36px_-18px_rgba(0,0,0,0.45)]");
    expect(resizeAwareSource).toContain("dark:bg-zinc-950/95");
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
    expect(drawerInteractionSource).toContain("type BottomTerminalTab");
    expect(drawerInteractionSource).toContain("const createTerminalTab");
    expect(drawerInteractionSource).toContain("const addTerminalTab");
    expect(drawerInteractionSource).toContain("const reorderTabs");
    expect(drawerInteractionSource).toContain("setDraggingTabId");
    expect(drawerInteractionSource).toContain("cursor-grabbing");
    expect(drawerInteractionSource).toContain('data-bottom-terminal-tab={tab.id}');
    expect(drawerInteractionSource).toContain("onPointerMove");
    expect(drawerInteractionSource).toContain("onSelect={() => addTerminalTab()}");
    expect(drawerInteractionSource).toContain("<TerminalPane");
    expect(drawerInteractionSource).not.toContain("contentTopPadding");
    expect(drawerInteractionSource).toContain('className="absolute inset-0"');
  });

  it("does not show a workspace coding-agent count in the drawer header", () => {
    expect(source).not.toContain("codingAgentCount");
    expect(source).not.toContain("Coding agents");
    expect(appSource).not.toContain("activeWorkspaceCodingAgentCount");
    expect(workspaceTerminalViewSource).not.toContain("countActiveCodingAgents");
  });
});
