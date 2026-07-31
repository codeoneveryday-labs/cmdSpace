import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourceControlPath = path.join(here, "useSourceControl.ts");

describe("useSourceControl repo change syncing", () => {
  it("refreshes the source control snapshot when another pane changes the same repo", () => {
    const source = readFileSync(sourceControlPath, "utf8");

    expect(source).toContain("GIT_REPO_CHANGED_EVENT");
    expect(source).toContain("gitRepoRootFromChangedEvent");
    expect(source).toContain("pathBelongsToRepo");
    expect(source).toContain(
      "window.addEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);",
    );
    expect(source).toContain("currentRepoRoot === changedRepoRoot");
    expect(source).toContain("pathBelongsToRepo(contextPath, changedRepoRoot)");
    expect(source).toContain("const pendingRefresh = inflightRef.current;");
    expect(source).toContain("pendingRefresh.finally(() =>");
    expect(source).toContain('void refresh({ remote: "never" });');
  });
});
