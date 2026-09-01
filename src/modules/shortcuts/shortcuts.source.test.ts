import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const shortcutsPath = path.join(here, "shortcuts.ts");
const globalShortcutsPath = path.join(here, "lib/useGlobalShortcuts.ts");
const tabBarPath = path.join(here, "../tabs/TabBar.tsx");
const appPath = path.join(here, "../../app/App.tsx");
const appShortcutPath = path.join(here, "../../app/lib/appShortcutCoordination.ts");
const appWindowEventsPath = path.join(here, "../../app/lib/useAppWindowEvents.ts");
const appPaneActionsPath = path.join(here, "../../app/lib/useAppPaneActions.ts");

function readAppShortcutSource() {
  return [
    readFileSync(appPath, "utf8"),
    readFileSync(appShortcutPath, "utf8"),
    readFileSync(appWindowEventsPath, "utf8"),
    readFileSync(appPaneActionsPath, "utf8"),
  ].join("\n");
}
const shortcutsSectionPath = path.join(
  here,
  "../../settings/sections/ShortcutsSection.tsx",
);

describe("tab creation shortcuts", () => {
  it("registers Git Graph and Architecture shortcuts in the shared settings registry", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const tabBarSource = readFileSync(tabBarPath, "utf8");
    const appSource = readAppShortcutSource();
    const settingsSource = readFileSync(shortcutsSectionPath, "utf8");

    expect(shortcutsSource).toContain('| "tab.newGitGraph"');
    expect(shortcutsSource).toContain('| "tab.newArchitecture"');
    expect(shortcutsSource).toContain('id: "tab.newGitGraph"');
    expect(shortcutsSource).toContain('label: "New Git Graph tab"');
    expect(shortcutsSource).toContain('id: "tab.newArchitecture"');
    expect(shortcutsSource).toContain('label: "New Architecture tab"');
    expect(shortcutsSource).toContain(
      'id: "tab.newGitGraph",\n    label: "New Git Graph tab",\n    group: "Tabs",\n    defaultBindings: [{ [MOD_PROP]: true, key: "g" }]',
    );
    expect(shortcutsSource).toContain(
      'id: "tab.newArchitecture",\n    label: "New Architecture tab",\n    group: "Tabs",\n    defaultBindings: [{ [MOD_PROP]: true, key: "a" }]',
    );
    expect(appSource).toContain('"tab.newGitGraph": () => {');
    expect(appSource).toContain("if (actions.hasGitRepository) actions.openGitGraph();");
    expect(appSource).toContain('"tab.newArchitecture": actions.openArchitecture');
    expect(tabBarSource).toContain('shortcutFor("tab.newGitGraph")');
    expect(tabBarSource).toContain('shortcutFor("tab.newArchitecture")');
    expect(settingsSource).not.toContain('s.id !== "tab.newGitGraph"');
    expect(settingsSource).not.toContain('s.id !== "tab.newArchitecture"');
  });
});

describe("voice agent shortcut", () => {
  it("registers a single cross-platform toggle for the floating voice agent", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readAppShortcutSource();

    expect(shortcutsSource).toContain('| "voice.toggle"');
    expect(shortcutsSource).toContain('id: "voice.toggle"');
    expect(shortcutsSource).toContain('label: "Toggle Space"');
    expect(shortcutsSource).toContain(
      'id: "voice.toggle",\n    label: "Toggle Space",\n    group: "AI",\n    defaultBindings: [{ [MOD_PROP]: true, shift: true, key: "v" }]',
    );
    expect(appSource).toContain('"voice.toggle": actions.toggleVoice');
    expect(appSource).toContain(
      'listen("cmdspace:open-shortcuts",',
    );
  });
});

describe("bottom terminal shortcut", () => {
  it("assigns Cmd/Ctrl+I to the bottom terminal", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readAppShortcutSource();

    expect(shortcutsSource).toContain('| "terminal.bottom"');
    expect(shortcutsSource).toContain('id: "terminal.bottom"');
    expect(shortcutsSource).toContain('defaultBindings: [{ [MOD_PROP]: true, key: "i" }]');
    expect(shortcutsSource).not.toContain('id: "ai.toggle"');
    expect(appSource).toContain('"terminal.bottom": actions.toggleBottomTerminal');
    expect(appSource).not.toContain('"ai.toggle": togglePanelAndFocus');
  });
});

describe("pane maximize shortcut", () => {
  it("registers Cmd/Ctrl+> for shared pane maximize", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const globalShortcutsSource = readFileSync(globalShortcutsPath, "utf8");
    const appSource = readAppShortcutSource();

    expect(shortcutsSource).toContain('| "pane.maximize"');
    expect(shortcutsSource).toContain('id: "pane.maximize"');
    expect(shortcutsSource).toContain('label: "Maximize active pane"');
    expect(shortcutsSource).toContain(
      'defaultBindings: [{ [MOD_PROP]: true, shift: true, key: ">" }]',
    );
    expect(appSource).toContain('"pane.maximize": actions.maximizePane');
    expect(globalShortcutsSource).toContain(
      "!isPaneMaximizeKeyboardEvent(e)",
    );
    expect(appSource).toContain("toggleMaximizePane(activeTerminalTab.activeLeafId)");
    expect(appSource).toContain(
      'listen("cmdspace:maximize-pane",',
    );
  });
});

describe("workspace navigation shortcuts", () => {
  it("uses up and down labels that match the workspace list direction", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readAppShortcutSource();

    expect(shortcutsSource).toContain('id: "workspace.next"');
    expect(shortcutsSource).toContain('label: "Workspace down"');
    expect(shortcutsSource).toContain(
      'defaultBindings: [{ [MOD_PROP]: true, alt: true, key: "ArrowDown" }]',
    );
    expect(shortcutsSource).toContain('id: "workspace.prev"');
    expect(shortcutsSource).toContain('label: "Workspace up"');
    expect(shortcutsSource).toContain(
      'defaultBindings: [{ [MOD_PROP]: true, alt: true, key: "ArrowUp" }]',
    );
    expect(appSource).toContain('"workspace.next": () => actions.cycleWorkspace(1)');
    expect(appSource).toContain('"workspace.prev": () => actions.cycleWorkspace(-1)');
  });

  it("opens the adjacent workspace from the ordered workspace list", () => {
    const appSource = readAppShortcutSource();

    expect(appSource).toContain(
      "const index = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId)",
    );
    expect(appSource).toContain(
      "handleSelectWorkspace(workspaces[nextIndex].id)",
    );
  });
});

describe("music shortcut", () => {
  it("opens Music CLI with Cmd/Ctrl+J without adding another terminal shortcut", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readAppShortcutSource();

    expect(shortcutsSource).toContain('| "music.open"');
    expect(shortcutsSource).toContain('id: "music.open"');
    expect(shortcutsSource).toContain('label: "Open Music CLI"');
    expect(shortcutsSource).toContain('defaultBindings: [{ [MOD_PROP]: true, key: "j" }]');
    expect(appSource).toContain('"music.open": actions.openMusic');
    expect(appSource).toContain('"music.open": actions.openMusic');
  });
});
