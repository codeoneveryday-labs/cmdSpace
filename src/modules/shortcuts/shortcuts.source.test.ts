import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const shortcutsPath = path.join(here, "shortcuts.ts");
const tabBarPath = path.join(here, "../tabs/TabBar.tsx");
const appPath = path.join(here, "../../app/App.tsx");
const shortcutsSectionPath = path.join(
  here,
  "../../settings/sections/ShortcutsSection.tsx",
);

describe("tab creation shortcuts", () => {
  it("registers Git Graph and Architecture shortcuts in the shared settings registry", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const tabBarSource = readFileSync(tabBarPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");
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
    expect(appSource).toContain("if (sourceControl.hasRepo) void openGitGraphFromContext();");
    expect(appSource).toContain('"tab.newArchitecture": () => newArchitectureTab()');
    expect(tabBarSource).toContain('shortcutFor("tab.newGitGraph")');
    expect(tabBarSource).toContain('shortcutFor("tab.newArchitecture")');
    expect(settingsSource).not.toContain('s.id !== "tab.newGitGraph"');
    expect(settingsSource).not.toContain('s.id !== "tab.newArchitecture"');
  });
});

describe("voice agent shortcut", () => {
  it("registers a single cross-platform toggle for the floating voice agent", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(shortcutsSource).toContain('| "voice.toggle"');
    expect(shortcutsSource).toContain('id: "voice.toggle"');
    expect(shortcutsSource).toContain('label: "Toggle Space"');
    expect(shortcutsSource).toContain(
      'id: "voice.toggle",\n    label: "Toggle Space",\n    group: "AI",\n    defaultBindings: [{ [MOD_PROP]: true, alt: true, key: "v" }]',
    );
    expect(appSource).toContain('"voice.toggle": toggleVoiceAgent');
  });
});

describe("bottom terminal shortcut", () => {
  it("assigns Cmd/Ctrl+I to the bottom terminal", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(shortcutsSource).toContain('| "terminal.bottom"');
    expect(shortcutsSource).toContain('id: "terminal.bottom"');
    expect(shortcutsSource).toContain('defaultBindings: [{ [MOD_PROP]: true, key: "i" }]');
    expect(shortcutsSource).not.toContain('id: "ai.toggle"');
    expect(appSource).toContain('"terminal.bottom": toggleBottomTerminal');
    expect(appSource).not.toContain('"ai.toggle": togglePanelAndFocus');
  });
});

describe("pane maximize shortcut", () => {
  it("registers Cmd/Ctrl+Shift+V for shared pane maximize", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(shortcutsSource).toContain('| "pane.maximize"');
    expect(shortcutsSource).toContain('id: "pane.maximize"');
    expect(shortcutsSource).toContain('label: "Maximize active pane"');
    expect(shortcutsSource).toContain(
      'defaultBindings: [{ [MOD_PROP]: true, shift: true, key: "v" }]',
    );
    expect(appSource).toContain('"pane.maximize": () => {');
    expect(appSource).toContain("toggleMaximizePane(activeTerminalTab.activeLeafId)");
  });
});

describe("music shortcut", () => {
  it("opens Music CLI with Cmd/Ctrl+J without adding another terminal shortcut", () => {
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(shortcutsSource).toContain('| "music.open"');
    expect(shortcutsSource).toContain('id: "music.open"');
    expect(shortcutsSource).toContain('label: "Open Music CLI"');
    expect(shortcutsSource).toContain('defaultBindings: [{ [MOD_PROP]: true, key: "j" }]');
    expect(appSource).toContain('"music.open": openTopMusicTab');
    expect(appSource).toContain('"music.open": openTopMusicTab');
  });
});
