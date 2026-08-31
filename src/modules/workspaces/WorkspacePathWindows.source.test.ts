import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const panelPaths = [
  path.join(here, "WorkspacesPanel.tsx"),
  path.join(here, "WorkspaceSetupView.tsx"),
  path.join(here, "lib/workspaceSetupModel.ts"),
];

describe("workspace path Windows normalization boundaries", () => {
  it("keeps home expansion, drive detection, and slash normalization wired in the setup path helpers", () => {
    const source = panelPaths.map((filePath) => readFileSync(filePath, "utf8")).join("\n");

    expect(source).toContain(
      'target === "~" || target.startsWith("~/") || target.startsWith("~\\\\")',
    );
    expect(source).toContain("currentFolder.replace(/[\\\\/]+$/, \"\")");
    expect(source).toContain("/^[A-Za-z]:[\\\\/]/.test(path)");
    expect(source).toContain("const normalized = path.replace(/\\\\/g, \"/\");");
    expect(source).toContain(
      "const windowsMatch = /^[A-Za-z]:\\/Users\\/[^/]+/i.exec(normalized);",
    );
    expect(source).toContain("if (drive) return joined ? `${drive}/${joined}` : `${drive}/`;");
  });
});
