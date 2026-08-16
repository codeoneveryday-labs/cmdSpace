import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "TerminalNavigationControls.tsx");

describe("TerminalNavigationControls", () => {
  it("offers the standard directory and guarded Git branch switchers to every terminal host", () => {
    expect(existsSync(sourcePath)).toBe(true);
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("listTerminalSubdirectories(cwd, showHidden)");
    expect(source).toContain(".. (Parent Directory)");
    expect(source).toContain("onChangeDirectory(parentPath)");
    expect(source).toContain("native.gitResolveRepo(cwd)");
    expect(source).toContain("wouldCheckoutReloadDevApp");
    expect(source).toContain("`git checkout ${shellQuote(branch)}`");
    expect(source).toContain("emitGitRepoChanged(repoRoot)");
  });

  it("opens the inline directory browser without starting terminal drag", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('data-directory-picker="inline"');
    expect(source).toContain("onPointerDown={(event) => event.stopPropagation()}");
  });
});
