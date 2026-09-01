import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const useTabsSource = readFileSync(join(here, "useTabs.ts"), "utf8");
const closeActionsSource = readFileSync(
  join(here, "useTabCloseActions.ts"),
  "utf8",
);

describe("useTabs close-action seam", () => {
  it("keeps tab and pane cleanup behind one lifecycle adapter", () => {
    expect(useTabsSource).toContain("useTabCloseActions({");
    expect(useTabsSource).not.toContain("const closeTab = useCallback");
    expect(closeActionsSource).toContain("closeTabState");
    expect(closeActionsSource).toContain("closeTerminalPaneState");
    expect(closeActionsSource).toContain("resetWorkspaceState");
    expect(closeActionsSource).toContain("disposeSession");
  });
});
