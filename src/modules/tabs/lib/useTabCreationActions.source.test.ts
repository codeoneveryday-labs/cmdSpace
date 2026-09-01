import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const useTabsSource = readFileSync(join(here, "useTabs.ts"), "utf8");
const creationSource = readFileSync(
  join(here, "useTabCreationActions.ts"),
  "utf8",
);

describe("useTabs creation seam", () => {
  it("keeps tab creation policy behind the shared state and ID interface", () => {
    expect(useTabsSource).toContain("useTabCreationActions({");
    expect(useTabsSource).not.toContain("const newWorkspaceTab = useCallback");
    expect(creationSource).toContain("createPaneTree");
    expect(creationSource).toContain("createAgentChatTab");
    expect(creationSource).toContain("openMarkdownTabState");
    expect(creationSource).toContain("createArchitectureTab");
  });
});
