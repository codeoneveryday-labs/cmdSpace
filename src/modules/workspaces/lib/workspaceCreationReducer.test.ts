import { describe, expect, it } from "vitest";
import {
  workspaceSetupReducer,
  type WorkspaceSetupState,
} from "./workspaceCreationReducer";

describe("workspaceCreationReducer", () => {
  const initialState: WorkspaceSetupState = {
    step: "layout",
    workspaceName: "My Workspace",
    workspaceColor: "#3b82f6",
    terminalCount: 2,
    workspaceMode: "standard",
    selectedChatAgent: null,
    selectedFolder: "/Users/demo/project",
    isolateAgentWorktrees: false,
  };

  it("handles step transition", () => {
    const next = workspaceSetupReducer(initialState, {
      type: "SET_STEP",
      step: "agents",
    });
    expect(next.step).toBe("agents");
  });

  it("switches to agents step automatically when setting agent mode", () => {
    const next = workspaceSetupReducer(initialState, {
      type: "SET_MODE",
      mode: "agent",
    });
    expect(next.workspaceMode).toBe("agent");
    expect(next.step).toBe("agents");
  });

  it("updates terminal count and folder", () => {
    let state = workspaceSetupReducer(initialState, {
      type: "SET_TERMINAL_COUNT",
      count: 4,
    });
    expect(state.terminalCount).toBe(4);

    state = workspaceSetupReducer(state, {
      type: "SET_SELECTED_FOLDER",
      folder: "/Users/demo/other",
    });
    expect(state.selectedFolder).toBe("/Users/demo/other");
  });

  it("handles reset", () => {
    const modified = workspaceSetupReducer(initialState, {
      type: "SET_NAME",
      name: "Changed",
    });
    expect(modified.workspaceName).toBe("Changed");

    const reset = workspaceSetupReducer(modified, {
      type: "RESET",
      initialState,
    });
    expect(reset).toEqual(initialState);
  });
});
