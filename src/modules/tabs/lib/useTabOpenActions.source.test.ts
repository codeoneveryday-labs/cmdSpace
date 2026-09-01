import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const useTabsSource = readFileSync(join(here, "useTabs.ts"), "utf8");
const openActionsSource = readFileSync(
  join(here, "useTabOpenActions.ts"),
  "utf8",
);

describe("useTabs open-action seam", () => {
  it("keeps editor, AI diff, Git and patch actions behind one transition adapter", () => {
    expect(useTabsSource).toContain("useTabOpenActions({");
    expect(useTabsSource).not.toContain("const openFileTab = useCallback");
    expect(openActionsSource).toContain("openEditorTabState");
    expect(openActionsSource).toContain("openAiDiffState");
    expect(openActionsSource).toContain("openGitDiffState");
    expect(openActionsSource).toContain("applyTabPatch");
    expect(openActionsSource).toContain("tabsRef.current");
  });
});
