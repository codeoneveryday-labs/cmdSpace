import { describe, expect, it } from "vitest";
import { getWorkspaceCliAgent } from "./workspaceAgentModel";

describe("workspaceAgentModel", () => {
  it("returns the shared CLI agent for a fully homogeneous workspace", () => {
    expect(
      getWorkspaceCliAgent([
        { agent: "claude" },
        { agent: "claude" },
      ]),
    ).toBe("claude");
  });

  it("does not select a logo for mixed or non-agent terminals", () => {
    expect(
      getWorkspaceCliAgent([
        { agent: "claude" },
        { agent: "codex" },
      ]),
    ).toBeNull();
    expect(getWorkspaceCliAgent([{ agent: "claude" }, {}])).toBeNull();
    expect(getWorkspaceCliAgent([])).toBeNull();
    expect(getWorkspaceCliAgent(undefined)).toBeNull();
  });
});
