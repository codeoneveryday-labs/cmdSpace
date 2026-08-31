import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceMode } from "../WorkspacesPanel";
import { TERMINAL_COUNTS } from "./workspaceSetupModel";

export type WorkspaceSetupStep = "layout" | "agents";

export type WorkspaceSetupState = {
  step: WorkspaceSetupStep;
  workspaceName: string;
  workspaceColor: string;
  terminalCount: (typeof TERMINAL_COUNTS)[number];
  workspaceMode: WorkspaceMode;
  selectedChatAgent: CliAgent | null;
  selectedFolder: string;
  isolateAgentWorktrees: boolean;
};

export type WorkspaceSetupAction =
  | { type: "SET_STEP"; step: WorkspaceSetupStep }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_COLOR"; color: string }
  | { type: "SET_TERMINAL_COUNT"; count: (typeof TERMINAL_COUNTS)[number] }
  | { type: "SET_MODE"; mode: WorkspaceMode }
  | { type: "SET_SELECTED_CHAT_AGENT"; agent: CliAgent | null }
  | { type: "SET_SELECTED_FOLDER"; folder: string }
  | { type: "SET_ISOLATE_WORKTREES"; isolate: boolean }
  | { type: "RESET"; initialState: WorkspaceSetupState };

export function workspaceSetupReducer(
  state: WorkspaceSetupState,
  action: WorkspaceSetupAction,
): WorkspaceSetupState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_NAME":
      return { ...state, workspaceName: action.name };
    case "SET_COLOR":
      return { ...state, workspaceColor: action.color };
    case "SET_TERMINAL_COUNT":
      return { ...state, terminalCount: action.count };
    case "SET_MODE":
      return {
        ...state,
        workspaceMode: action.mode,
        step: action.mode === "agent" ? "agents" : state.step,
      };
    case "SET_SELECTED_CHAT_AGENT":
      return { ...state, selectedChatAgent: action.agent };
    case "SET_SELECTED_FOLDER":
      return { ...state, selectedFolder: action.folder };
    case "SET_ISOLATE_WORKTREES":
      return { ...state, isolateAgentWorktrees: action.isolate };
    case "RESET":
      return action.initialState;
    default:
      return state;
  }
}
