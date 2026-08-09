import { describe, expect, it } from "vitest";
import { splitLeaf } from "./panes";

describe("imported terminal pane", () => {
  it("stores the resume launch plan on the new leaf", () => {
    expect(
      splitLeaf(
        { kind: "leaf", id: 1, cwd: "/repo" },
        1,
        2,
        3,
        "row",
        "/repo",
        "codex resume 'session-id'",
      ),
    ).toEqual({
      kind: "split",
      id: 2,
      dir: "row",
      children: [
        { kind: "leaf", id: 1, cwd: "/repo" },
        {
          kind: "leaf",
          id: 3,
          cwd: "/repo",
          lastCommand: "codex resume 'session-id'",
          autoLaunch: true,
        },
      ],
    });
  });
});
