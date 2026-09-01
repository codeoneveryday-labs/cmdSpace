import { describe, expect, it } from "vitest";
import {
  resolveActiveFilePath,
  resolveActiveTerminalLeafCwd,
  resolveSourceControlContextPath,
} from "./appContextModel";

describe("appContextModel", () => {
  it("resolves editor and git file paths", () => {
    expect(resolveActiveFilePath({ kind: "editor", id: 1, path: "/repo/README.md", title: "README.md", dirty: false, preview: false })).toBe("/repo/README.md");
    expect(resolveActiveFilePath({ kind: "git-diff", id: 2, path: "src/App.tsx", repoRoot: "/repo", title: "App.tsx", mode: "+", originalPath: null })).toBe("/repo/src/App.tsx");
  });

  it("uses the active surface as source-control context", () => {
    expect(resolveSourceControlContextPath(undefined, "/repo/src", "/repo", "/home")).toBe("/repo");
    expect(resolveSourceControlContextPath({ kind: "editor", id: 1, path: "/repo/src/App.tsx", title: "App.tsx", dirty: false, preview: false }, null, "/repo", "/home")).toBe("/repo/src");
    expect(resolveSourceControlContextPath({ kind: "git-history", id: 3, repoRoot: "/repo", title: "History" }, null, "/other", "/home")).toBe("/repo");
  });

  it("resolves terminal cwd from the active leaf before the tab fallback", () => {
    expect(
      resolveActiveTerminalLeafCwd({
        kind: "terminal",
        id: 1,
        title: "Terminal",
        cwd: "/repo",
        activeLeafId: 7,
        paneTree: { kind: "leaf", id: 7, cwd: "/repo/src" },
      } as never),
    ).toBe("/repo/src");
    expect(
      resolveActiveTerminalLeafCwd({
        kind: "terminal",
        id: 1,
        title: "Terminal",
        cwd: "/repo",
        activeLeafId: 7,
        paneTree: { kind: "leaf", id: 8, cwd: "/other" },
      } as never),
    ).toBe("/repo");
    expect(resolveActiveTerminalLeafCwd(undefined)).toBeNull();
  });
});
