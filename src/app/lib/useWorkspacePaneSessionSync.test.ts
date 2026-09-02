import { describe, expect, it } from "vitest";
import { collectWorkspaceCwds } from "./useWorkspacePaneSessionSync";

describe("collectWorkspaceCwds", () => {
  it("flushes workspaces even when their pane cache has not hydrated", () => {
    expect(
      [...collectWorkspaceCwds(
        [{ id: "canvas", workingFolder: "/canvas" }],
        {},
      ).entries()],
    ).toEqual([["canvas", "/canvas"]]);
  });

  it("uses a pane cwd only for workspaces without a record cwd", () => {
    expect(
      [...collectWorkspaceCwds(
        [
          { id: "standard", workingFolder: null },
          { id: "canvas", workingFolder: "/canvas" },
        ],
        {
          standard: [
            {
              paneIndex: 0,
              workingFolder: "/standard",
              autoLaunch: true,
              lastCommand: "codex",
              nativeSessionId: null,
            },
          ],
          canvas: [
            {
              paneIndex: 0,
              workingFolder: "/stale-canvas",
              autoLaunch: true,
              lastCommand: "codex",
              nativeSessionId: null,
            },
          ],
        },
      ).entries()],
    ).toEqual([
      ["canvas", "/canvas"],
      ["standard", "/standard"],
    ]);
  });
});
