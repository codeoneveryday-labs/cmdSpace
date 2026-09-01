import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const useTabsSource = readFileSync(join(here, "useTabs.ts"), "utf8");
const paneActionsSource = readFileSync(
  join(here, "useTabPaneActions.ts"),
  "utf8",
);

describe("useTabs pane-action seam", () => {
  it("keeps pane metadata, focus, lifecycle and maximize actions behind one adapter", () => {
    expect(useTabsSource).toContain("useTabPaneActions({");
    expect(useTabsSource).not.toContain("const splitActivePane = useCallback");
    expect(paneActionsSource).toContain("updateLeafCwd");
    expect(paneActionsSource).toContain("focusNextTerminalPane");
    expect(paneActionsSource).toContain("splitTerminalPane");
    expect(paneActionsSource).toContain("appendTerminalPaneModel");
    expect(paneActionsSource).toContain("toggleTerminalPaneMaximize");
  });
});
